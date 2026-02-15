// ============================================================
// 消息桥接：RC 消息 <-> OpenClaw Agent
// 入站：接收 RC 消息 → dispatchInboundMessage → Agent 处理 → 回调回复
// 出站：Agent 回复 → 格式化 → 发回 RC
// ============================================================

import type { RcMessage, RocketchatChannelConfig } from "../rc-api/types.js";
import type { BotManager } from "./bot-manager.js";
import type { OpenClawInternals } from "../gateway/openclaw-internals.js";

/** 长文本分块大小（Rocket.Chat 单条消息建议不超过 4000 字符） */
const MAX_MESSAGE_LENGTH = 4000;

/** Rocket.Chat 广播提及用户名：@here / @all / @everyone 不应触发机器人响应 */
const BROADCAST_MENTION_USERNAMES = new Set(["here", "all", "everyone"]);

/** 群组房间信息（由 ChannelService 注册） */
interface GroupRoomInfo {
  groupName: string;
  requireMention: boolean;
  bots: string[];
}

interface MessageHandlerOptions {
  botManager: BotManager;
  config: Partial<RocketchatChannelConfig>;
  logger?: { info: (msg: string) => void; error: (msg: string) => void };
  /** OpenClaw 内部模块引用（用于入站消息分发） */
  internals?: OpenClawInternals | null;
}

export class MessageHandler {
  private botManager: BotManager;
  private config: Partial<RocketchatChannelConfig>;
  private logger: { info: (msg: string) => void; error: (msg: string) => void };
  private internals: OpenClawInternals | null;
  /** 正在处理中的消息 ID 集合（防止并发重复处理） */
  private processingMessages = new Set<string>();
  /** 群组房间映射：roomId → GroupRoomInfo（用于区分 DM 和群组） */
  private groupRooms = new Map<string, GroupRoomInfo>();

  constructor(options: MessageHandlerOptions) {
    this.botManager = options.botManager;
    this.config = options.config;
    this.internals = options.internals || null;
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
    // 处理完成后清理（60 秒超时兜底）
    const cleanup = () => this.processingMessages.delete(msgKey);
    setTimeout(cleanup, 60000);

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

    this.logger.info(
      `入站: ${msg.u.username} -> ${botUsername} (Agent: ${agentId}): ${text.slice(0, 100)}...`,
    );

    try {
      await this.dispatchToAgent(
        text,
        botUsername,
        msg.u.username,
        roomId,
        agentId,
        msg._id,
      );
    } catch (err) {
      const errMsg = (err as Error).message || "";
      this.logger.error(`分发到 Agent 失败: ${errMsg}`);

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
  // 内部：入站消息分发
  // ----------------------------------------------------------

  /**
   * 将消息分发到 OpenClaw Agent
   *
   * 使用 dispatchInboundMessage（进程内直接调用）
   * 需要 OpenClaw 内部模块可用（在 Gateway 进程内运行时自动加载）
   */
  private async dispatchToAgent(
    text: string,
    botUsername: string,
    senderId: string,
    roomId: string,
    agentId: string,
    messageId: string,
  ): Promise<void> {
    if (this.internals) {
      await this.dispatchViaInternals(
        text,
        botUsername,
        senderId,
        roomId,
        agentId,
        messageId,
      );
    } else {
      this.logger.error(
        "OpenClaw 内部模块不可用，入站消息无法分发到 Agent",
      );
    }
  }

  /**
   * 通过 OpenClaw 内部 API 分发入站消息（首选方式）
   *
   * 构造 MsgContext → dispatchInboundMessage → Agent 处理
   * Agent 回复通过 dispatcher 的 deliver 回调直接发送到 RC
   */
  private async dispatchViaInternals(
    text: string,
    botUsername: string,
    senderId: string,
    roomId: string,
    agentId: string,
    messageId: string,
  ): Promise<void> {
    const internals = this.internals!;

    // 加载最新配置
    let cfg: Record<string, unknown>;
    try {
      cfg = internals.loadConfig();
    } catch {
      // 如果 loadConfig 失败，尝试用空配置
      cfg = {};
    }

    // 判断是 DM 还是群组
    const groupInfo = this.groupRooms.get(roomId);
    const isGroup = !!groupInfo;
    const chatType = isGroup ? "group" : "direct";

    // 构造 session key（格式参考 Telegram/Discord 等核心频道）
    const sessionKey = isGroup
      ? `agent:${agentId}:rocketchat:group:${botUsername}:${roomId}`
      : `agent:${agentId}:rocketchat:dm:${botUsername}:${roomId}`;

    // 构造 MsgContext（OpenClaw 入站消息上下文）
    const ctx: Record<string, unknown> = {
      Body: text,
      BodyForAgent: text,
      RawBody: text,
      CommandBody: text,
      BodyForCommands: text,
      From: isGroup
        ? `rocketchat:group:${roomId}:${senderId}`
        : `rocketchat:${senderId}`,
      To: isGroup
        ? `rocketchat:group:${roomId}`
        : `rocketchat:dm:${botUsername}`,
      SessionKey: sessionKey,
      AccountId: botUsername,
      Provider: "rocketchat",
      Surface: "rocketchat",
      OriginatingChannel: "rocketchat",
      OriginatingTo: roomId,
      ChatType: chatType,
      CommandAuthorized: true,
      MessageSid: messageId,
      SenderId: senderId,
      SenderName: senderId,
      SenderUsername: senderId,
    };

    // 群组消息额外字段
    if (isGroup && groupInfo) {
      ctx.GroupSubject = groupInfo.groupName;
    }

    // 创建 reply dispatcher —— Agent 回复通过 deliver 回调直接发到 RC
    const replyParts: string[] = [];
    const dispatcher = internals.createReplyDispatcher({
      deliver: async (
        payload: { text?: string; mediaUrl?: string },
        info: { kind: string },
      ) => {
        const replyText = payload.text?.trim() ?? "";
        if (!replyText) return;
        replyParts.push(replyText);

        // 实时发送每个回复块到 RC（而不是等全部完成再发）
        if (info.kind === "final" || info.kind === "block") {
          try {
            await this.handleOutbound(replyText, botUsername, roomId);
          } catch (err) {
            this.logger.error(
              `回复发送失败: ${(err as Error).message}`,
            );
          }
        }
      },
      onError: (err: unknown) => {
        this.logger.error(
          `Agent 处理错误: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    });

    // 分发入站消息 → Agent 处理 → 回复通过 deliver 回调发送
    await internals.dispatchInboundMessage({
      ctx,
      cfg,
      dispatcher,
    });

    // 如果 Agent 没有通过 dispatcher 回复（例如命令处理后无输出），
    // replyParts 为空也是正常的
    if (replyParts.length === 0) {
      this.logger.info(`Agent 处理完成，无回复内容（可能是命令或空响应）`);
    }
  }

  // ----------------------------------------------------------
  // 群组房间注册
  // ----------------------------------------------------------

  /**
   * 注册群组房间（由 ChannelService.ensureGroups 调用）
   * 用于区分 DM 和群组，以及获取群组的 requireMention 配置
   */
  registerGroupRoom(roomId: string, info: GroupRoomInfo): void {
    this.groupRooms.set(roomId, info);
  }

  // ----------------------------------------------------------
  // 内部：@提及 判断
  // ----------------------------------------------------------

  /**
   * 判断机器人是否应该响应该消息
   *
   * DM 消息：始终响应（roomId 不在 groupRooms 中）
   * 群组消息：
   *   1. 过滤广播提及（@here / @all / @everyone）—— 仅广播提及时不响应
   *   2. 如果群组配置了 requireMention，只有直接 @机器人 才响应
   *   3. 如果未配置 requireMention，除了广播提及外都响应
   */
  private shouldRespond(
    msg: RcMessage,
    botUsername: string,
    roomId: string,
  ): boolean {
    const groupInfo = this.groupRooms.get(roomId);

    // DM 消息：始终响应
    if (!groupInfo) {
      return true;
    }

    // ---- 群组消息逻辑 ----

    const mentions = msg.mentions || [];

    // 检查机器人是否被直接 @提及（排除广播提及）
    const isBotMentioned = mentions.some(
      (m) => m.username === botUsername,
    );

    // 检查消息是否包含广播提及（@here / @all / @everyone）
    const hasBroadcastMention = mentions.some(
      (m) => BROADCAST_MENTION_USERNAMES.has(m.username),
    );

    // 如果消息只有广播提及、没有直接 @机器人 → 不响应
    if (hasBroadcastMention && !isBotMentioned) {
      return false;
    }

    // 如果群组要求 @提及 才响应
    if (groupInfo.requireMention && !isBotMentioned) {
      return false;
    }

    return true;
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
