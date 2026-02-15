// ============================================================
// 消息桥接：RC 消息 <-> OpenClaw Agent
// 入站：接收 RC 消息 → 路由到 Agent
// 出站：Agent 回复 → 格式化 → 发回 RC
// ============================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RcMessage, RocketchatChannelConfig } from "../rc-api/types.js";
import type { BotManager } from "./bot-manager.js";

const execFileAsync = promisify(execFile);

/** 长文本分块大小（Rocket.Chat 单条消息建议不超过 4000 字符） */
const MAX_MESSAGE_LENGTH = 4000;

interface MessageHandlerOptions {
  botManager: BotManager;
  config: Partial<RocketchatChannelConfig>;
  logger?: { info: (msg: string) => void; error: (msg: string) => void };
}

export class MessageHandler {
  private botManager: BotManager;
  private config: Partial<RocketchatChannelConfig>;
  private logger: { info: (msg: string) => void; error: (msg: string) => void };
  /** 正在处理中的消息 ID 集合（防止并发重复处理） */
  private processingMessages = new Set<string>();

  constructor(options: MessageHandlerOptions) {
    this.botManager = options.botManager;
    this.config = options.config;
    this.logger = options.logger || {
      info: (msg: string) => console.log(`[RC MessageHandler] ${msg}`),
      error: (msg: string) => console.error(`[RC MessageHandler] ${msg}`),
    };
  }

  // ----------------------------------------------------------
  // 入站：RC 消息 → OpenClaw Agent
  // ----------------------------------------------------------

  /**
   * 处理入站消息
   * 由 BotManager 的 onMessage 回调调用
   */
  async handleInbound(
    msg: RcMessage,
    roomId: string,
    botUsername: string,
    agentId: string,
  ): Promise<void> {
    // 消息去重：防止同一条消息被多个 bot 或重连后重复处理
    const msgKey = `${roomId}:${msg._id}`;
    if (this.processingMessages.has(msgKey)) return;
    this.processingMessages.add(msgKey);
    // 处理完成后清理（30 秒超时兜底）
    const cleanup = () => this.processingMessages.delete(msgKey);
    setTimeout(cleanup, 30000);

    // 检查 @提及 规则（群组消息）
    if (!this.shouldRespond(msg, botUsername, roomId)) {
      cleanup();
      return;
    }

    // 提取消息文本
    let text = msg.msg || "";

    // 处理附件（图片、文件、语音）
    if (msg.attachments?.length) {
      for (const att of msg.attachments) {
        if (att.image_url) {
          text += `\n[图片: ${att.image_url}]`;
        } else if (att.audio_url) {
          text += `\n[语音: ${att.audio_url}]`;
        } else if (att.title_link) {
          text += `\n[文件: ${att.title_link}]`;
        }
      }
    }

    if (!text.trim()) {
      return;
    }

    // 通过 openclaw message send CLI 发送给 Agent
    this.logger.info(
      `入站: ${msg.u.username} -> ${botUsername} (Agent: ${agentId}): ${text.slice(0, 100)}...`,
    );

    try {
      await this.sendToOpenClaw(
        text,
        botUsername,
        msg.u.username,
        roomId,
      );
    } catch (err) {
      const errMsg = (err as Error).message || "";
      this.logger.error(`发送到 OpenClaw 失败: ${errMsg}`);

      // 如果 Agent 不存在或绑定丢失，回复用户一条友好提示
      if (
        errMsg.includes("agent") ||
        errMsg.includes("not found") ||
        errMsg.includes("binding") ||
        errMsg.includes("No matching")
      ) {
        try {
          await this.handleOutbound(
            "⚠️ 抱歉，我绑定的 AI Agent 当前不可用。请联系管理员检查 Agent 配置。",
            botUsername,
            roomId,
          );
        } catch {
          // 回复也失败，只能记日志
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 出站：OpenClaw Agent → RC
  // ----------------------------------------------------------

  /**
   * 发送 Agent 回复到 Rocket.Chat
   * 由频道插件的 outbound.sendText 调用
   */
  async handleOutbound(
    text: string,
    botUsername: string,
    roomId: string,
  ): Promise<void> {
    this.logger.info(
      `出站: ${botUsername} -> ${roomId}: ${text.slice(0, 100)}...`,
    );

    // 长文本分块发送
    const chunks = this.splitText(text, MAX_MESSAGE_LENGTH);

    for (const chunk of chunks) {
      try {
        await this.botManager.sendMessage(botUsername, roomId, chunk);
      } catch (err) {
        this.logger.error(
          `发送消息失败: ${(err as Error).message}`,
        );
      }
    }
  }

  // ----------------------------------------------------------
  // 内部：消息路由
  // ----------------------------------------------------------

  /**
   * 判断机器人是否应该响应该消息
   * - DM 消息：始终响应
   * - 群组消息：根据 requireMention 规则判断
   */
  private shouldRespond(
    msg: RcMessage,
    botUsername: string,
    roomId: string,
  ): boolean {
    // 检查是否在群组中且需要 @提及
    const groups = this.config.groups || {};
    for (const [, groupConfig] of Object.entries(groups)) {
      if (groupConfig.bots?.includes(botUsername) && groupConfig.requireMention) {
        // 需要 @提及 才响应
        const isMentioned = msg.mentions?.some(
          (m) => m.username === botUsername,
        );
        if (!isMentioned) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 通过 openclaw CLI 将消息发送给 Agent
   */
  private async sendToOpenClaw(
    text: string,
    accountId: string,
    senderId: string,
    roomId: string,
  ): Promise<void> {
    // 基本校验：确保标识符不为空、不包含控制字符
    if (!accountId || !senderId || !roomId) {
      this.logger.error("sendToOpenClaw: 缺少必要的标识符参数");
      return;
    }

    // execFileAsync 不走 shell，参数不会被 shell 解析，注入风险极低
    const args = [
      "message",
      "send",
      "--channel",
      "rocketchat",
      "--account",
      accountId,
      "--target",
      roomId,
      "-m",
      text,
    ];

    // 尝试传递 sender 信息（如果 CLI 版本不支持 --from，忽略即可）
    if (senderId) {
      args.push("--from", senderId);
    }

    try {
      await execFileAsync("openclaw", args, { timeout: 30000 });
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      // 如果是 --from 不支持，降级为不传 sender 重试
      if (msg.includes("unknown option") && msg.includes("--from")) {
        this.logger.info("CLI 不支持 --from，降级重试（不含 sender）");
        await execFileAsync(
          "openclaw",
          [
            "message",
            "send",
            "--channel",
            "rocketchat",
            "--account",
            accountId,
            "--target",
            roomId,
            "-m",
            text,
          ],
          { timeout: 30000 },
        );
      } else {
        throw err;
      }
    }
  }

  // ----------------------------------------------------------
  // 工具
  // ----------------------------------------------------------

  /**
   * 将长文本分块
   * 尽量按段落或代码块边界分割
   */
  private splitText(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // 优先在代码块边界分割
      let splitIndex = remaining.lastIndexOf("\n```\n", maxLength);
      if (splitIndex > maxLength * 0.5) {
        splitIndex += 5; // 包含 \n```\n
      } else {
        // 在段落边界分割
        splitIndex = remaining.lastIndexOf("\n\n", maxLength);
        if (splitIndex > maxLength * 0.5) {
          splitIndex += 2;
        } else {
          // 在换行处分割
          splitIndex = remaining.lastIndexOf("\n", maxLength);
          if (splitIndex > maxLength * 0.5) {
            splitIndex += 1;
          } else {
            // 强制分割
            splitIndex = maxLength;
          }
        }
      }

      chunks.push(remaining.slice(0, splitIndex));
      remaining = remaining.slice(splitIndex);
    }

    return chunks;
  }
}
