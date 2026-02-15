// ============================================================
// 消息桥接：RC 消息 <-> OpenClaw Agent
// 入站：接收 RC 消息 → dispatchInboundMessage → Agent 处理 → 回调回复
// 出站：Agent 回复 → 格式化 → 发回 RC
// ============================================================

import type { RcMessage, RocketchatChannelConfig } from "../rc-api/types.js";
import type { BotManager } from "./bot-manager.js";

/** 长文本分块大小（Rocket.Chat 单条消息建议不超过 4000 字符） */
const MAX_MESSAGE_LENGTH = 4000;

// ============================================================
// ! 命令系统：替代 Rocket.Chat 原生斜杠命令（避免冲突）
// Rocket.Chat 内置了 /help、/join 等斜杠命令，会在客户端被拦截。
// 我们用 ! 前缀替代，在消息到达 Agent 之前拦截或翻译。
// ============================================================

/** 命令前缀 */
const CMD_PREFIX = "!";

/**
 * 自然语言 → 命令映射
 * 仅当用户发送的**整条消息**与 key 完全一致时才触发（精确匹配）。
 * key 必须是小写（匹配时会对用户输入做 trim + toLowerCase）。
 *
 * 注意：不要添加日常对话中常见的短词（如"帮助"、"状态"），
 * 以免用户正常聊天被误拦截。所有 key 至少应是明确的"命令意图"。
 */
const NATURAL_LANGUAGE_COMMANDS: Record<string, string> = {
  // !help — 显示帮助菜单
  "查看命令": "help",
  "命令列表": "help",
  "命令帮助": "help",
  // !reset / !new — 会话管理
  "重置对话": "reset",
  "清空对话": "reset",
  "新对话": "new",
  "开始新对话": "new",
  // !clear — 清除会话但保留记忆
  "清除会话": "clear",
  // !compact — 压缩上下文
  "压缩对话": "compact",
  "压缩上下文": "compact",
  // !status — 查看状态
  "查看状态": "status",
  "当前状态": "status",
  // !model — 切换模型
  "切换模型": "model",
  "模型列表": "model list",
  "查看模型": "model",
  // !abort — 终止回复
  "停止回复": "abort",
  "终止回复": "abort",
  // !usage — 用量统计
  "查看用量": "usage",
  "用量统计": "usage",
  // !context — 上下文信息
  "查看上下文": "context",
  "上下文信息": "context",
  // !think — 思考深度
  "思考深度": "think",
  // !agents — Agent 列表
  "查看代理": "agents",
  "代理列表": "agents",
  // !tools — 工具列表
  "查看工具": "tools",
  "工具列表": "tools",
  // !skills — 技能列表
  "查看技能": "skills",
  "技能列表": "skills",
};

/**
 * 帮助菜单文本
 * 当用户输入 !help 或 "命令帮助" 时，直接回复此内容（不经过 Agent）
 */
function buildHelpText(): string {
  return [
    "🦞 **OpenClaw 命令帮助**",
    "",
    "以下是 OpenClaw 官方内置命令。",
    "由于 Rocket.Chat 自带 `/` 斜杠命令会被客户端拦截，",
    "在 Rocket.Chat 中请使用 `!` 前缀代替 `/`。",
    "",
    "**📋 上下文管理：**",
    "| 命令 | 自然语言 | 说明 |",
    "| --- | --- | --- |",
    "| `!compact` | 压缩对话 | 对话变卡时用，压缩旧消息释放上下文空间 |",
    "| `!clear` | 清除会话 | 清除当前会话消息，但保留 AI 的长期记忆 |",
    "| `!reset` | 重置对话 | 彻底重新开始，清空所有上下文和记忆 |",
    "| `!new` | 新对话 | 开始全新对话，可顺便切模型：`!new glm` |",
    "| `!status` | 查看状态 | 查看当前 Agent、模型和 token 使用情况 |",
    "",
    "**🤖 模型切换：**",
    "| 命令 | 自然语言 | 说明 |",
    "| --- | --- | --- |",
    "| `!model` | 切换模型 | 显示可用模型列表，选编号即可切换 |",
    "| `!model status` | — | 查看当前模型的详细配置信息 |",
    "| `!model glm` | — | 快速切换到 GLM 模型（模糊匹配） |",
    "",
    "**🔧 工具和技能：**",
    "| 命令 | 自然语言 | 说明 |",
    "| --- | --- | --- |",
    "| `!tools` | 查看工具 | 列出当前 Agent 可用的所有工具 |",
    "| `!skills` | 查看技能 | 列出已安装的技能（Skill） |",
    "| `!skill <名称>` | — | 运行指定技能 |",
    "",
    "**⚙️ 其他实用：**",
    "| 命令 | 自然语言 | 说明 |",
    "| --- | --- | --- |",
    "| `!think <级别>` | 思考深度 | AI 推理深度（off/low/medium/high） |",
    "| `!reasoning` | — | 开启/关闭 AI 推理过程的单独展示 |",
    "| `!verbose` | — | 开启/关闭调试详细输出 |",
    "| `!usage` | 查看用量 | 显示 token 用量和费用统计 |",
    "| `!context` | 查看上下文 | 显示上下文大小构成明细 |",
    "| `!agents` | 代理列表 | 查看可用 Agent 列表 |",
    "| `!abort` | 终止回复 | 立即终止 AI 正在生成的回复 |",
    "| `!help` | 命令帮助 | 显示此帮助菜单 |",
    "",
    "**💡 最常用：**",
    "- `!compact` — 对话变卡时用",
    "- `!model glm` — 快速切模型",
    "- `!status` — 看 token 用了多少",
    "- `!reset` — 完全重新开始",
    "",
    "**使用方式：** `!reset` 或发送 `重置对话`（效果相同）",
  ].join("\n");
}

/** processingMessages 集合的最大容量（防止内存泄漏） */
const MAX_PROCESSING_SET_SIZE = 1000;

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
  /**
   * OpenClaw Plugin Runtime（由 api.runtime 提供）
   * 包含 channel.reply.dispatchReplyFromConfig 等核心 API
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime?: any;
}

/** 群组历史消息条目（用于 InboundHistory） */
interface HistoryEntry {
  sender: string;
  body: string;
  timestamp?: number;
}

/** 群组历史消息的最大条目数 */
const MAX_GROUP_HISTORY_ENTRIES = 10;

export class MessageHandler {
  private botManager: BotManager;
  private config: Partial<RocketchatChannelConfig>;
  private logger: { info: (msg: string) => void; error: (msg: string) => void };
  /** OpenClaw Plugin Runtime */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private runtime: any;
  /** 正在处理中的消息 ID 集合（防止并发重复处理） */
  private processingMessages = new Set<string>();
  /** 群组房间映射：roomId → GroupRoomInfo（用于区分 DM 和群组） */
  private groupRooms = new Map<string, GroupRoomInfo>();
  /** 群组消息历史：roomId → 最近被跳过的消息（用于 InboundHistory，参考 Telegram） */
  private groupHistories = new Map<string, HistoryEntry[]>();

  constructor(options: MessageHandlerOptions) {
    this.botManager = options.botManager;
    this.config = options.config;
    this.runtime = options.runtime || null;
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

    // 防止内存泄漏：集合过大时清空最旧的条目
    if (this.processingMessages.size >= MAX_PROCESSING_SET_SIZE) {
      const oldest = this.processingMessages.values().next().value;
      if (oldest) this.processingMessages.delete(oldest);
    }

    this.processingMessages.add(msgKey);
    // 处理完成后清理（60 秒超时兜底）
    const cleanup = () => this.processingMessages.delete(msgKey);
    setTimeout(cleanup, 60000);

    // 检查 @提及 规则（群组消息）
    const respondCheck = this.checkRespond(msg, botUsername, roomId);
    if (!respondCheck.shouldRespond) {
      // 群组中未被提及的消息：记录到历史（供后续 InboundHistory 使用）
      this.recordGroupHistory(roomId, msg);
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

    // ---- ! 命令拦截 ----
    // 在分发到 Agent 之前，检查是否为 ! 命令或自然语言命令
    const commandResult = this.interceptCommand(text.trim());

    if (commandResult.action === "reply") {
      // 命令由插件本地处理（如 !help），直接回复
      this.logger.info(`命令拦截 (本地处理): ${text.trim()}`);
      try {
        await this.handleOutbound(commandResult.replyText!, botUsername, roomId);
      } catch (err) {
        this.logger.error(`命令回复失败: ${(err as Error).message}`);
      }
      cleanup();
      return;
    }

    if (commandResult.action === "transform") {
      // 命令需要转换后传给 Agent（如 !reset → /reset）
      this.logger.info(`命令拦截 (转换): ${text.trim()} → ${commandResult.transformedText}`);
      text = commandResult.transformedText!;
    }
    // action === "passthrough"：非命令消息，原样传递

    // 构造发送者信息（显示名 + 用户名）
    const senderDisplayName = msg.u.name || msg.u.username;
    const senderUsername = msg.u.username;
    const senderId = msg.u._id;

    this.logger.info(
      `入站: ${senderUsername} -> ${botUsername} (Agent: ${agentId}): ${text.slice(0, 100)}...`,
    );

    try {
      await this.dispatchToAgent(
        text,
        botUsername,
        senderUsername,
        senderId,
        senderDisplayName,
        roomId,
        agentId,
        msg._id,
        respondCheck.wasMentioned,
        msg.tmid,
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
   * @param tmid 可选的线程父消息 ID（用于线程回复）
   */
  async handleOutbound(
    text: string,
    botUsername: string,
    roomId: string,
    tmid?: string,
  ): Promise<void> {
    this.logger.info(
      `出站: ${botUsername} -> ${roomId}: ${text.slice(0, 100)}...`,
    );

    // 长文本分块发送
    const chunks = this.splitText(text, MAX_MESSAGE_LENGTH);
    const options = tmid ? { tmid } : undefined;

    for (const chunk of chunks) {
      try {
        await this.botManager.sendMessage(botUsername, roomId, chunk, options);
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
   * 使用 Plugin Runtime API（api.runtime.channel.reply.*）
   * 参考官方 Feishu 插件的 dispatchReplyFromConfig 调用方式
   */
  private async dispatchToAgent(
    text: string,
    botUsername: string,
    senderUsername: string,
    senderId: string,
    senderDisplayName: string,
    roomId: string,
    agentId: string,
    messageId: string,
    wasMentioned: boolean,
    tmid?: string,
  ): Promise<void> {
    if (!this.runtime?.channel?.reply) {
      this.logger.error(
        "Plugin Runtime 不可用，入站消息无法分发到 Agent",
      );
      return;
    }

    await this.dispatchViaRuntime(
      text,
      botUsername,
      senderUsername,
      senderId,
      senderDisplayName,
      roomId,
      agentId,
      messageId,
      wasMentioned,
      tmid,
    );
  }

  /**
   * 通过 Plugin Runtime API 分发入站消息
   *
   * 流程（参考官方 Feishu 插件）：
   * 1. 构造消息上下文
   * 2. finalizeInboundContext → 生成规范化的 MsgContext
   * 3. createReplyDispatcherWithTyping → 创建回复分发器
   * 4. dispatchReplyFromConfig → 分发到 Agent
   * 5. Agent 回复通过 deliver 回调发送到 RC
   */
  private async dispatchViaRuntime(
    text: string,
    botUsername: string,
    senderUsername: string,
    senderId: string,
    senderDisplayName: string,
    roomId: string,
    agentId: string,
    messageId: string,
    wasMentioned: boolean,
    tmid?: string,
  ): Promise<void> {
    const replyApi = this.runtime.channel.reply;

    // 加载最新配置
    let cfg: Record<string, unknown>;
    try {
      cfg = this.runtime.config?.loadConfig?.() ?? {};
    } catch {
      cfg = {};
    }

    // 判断是 DM 还是群组
    const groupInfo = this.groupRooms.get(roomId);
    const isGroup = !!groupInfo;
    const chatType = isGroup ? "group" : "direct";

    // 构造 session key（格式参考 Telegram/Feishu 等核心频道）
    const sessionKey = isGroup
      ? `agent:${agentId}:rocketchat:group:${botUsername}:${roomId}`
      : `agent:${agentId}:rocketchat:dm:${botUsername}:${roomId}`;

    // 构造发送者标签（参考 Telegram 的 buildSenderLabel）
    // 群组中显示为 "显示名 (@用户名)"，让 Agent 知道是谁在说话
    const senderLabel = senderDisplayName !== senderUsername
      ? `${senderDisplayName} (@${senderUsername})`
      : `@${senderUsername}`;

    // 构造 Body（参考 Telegram/Slack 的 formatInboundEnvelope）
    // 群组消息：在消息前加上发送者标签，如 "张三 (@zhangsan): 你好"
    // DM 消息：不加前缀（只有一个人在对话）
    const bodyForAgent = text;
    const bodyWithSender = isGroup ? `${senderLabel}: ${text}` : text;

    // 构造 ConversationLabel（群组显示群名，DM 显示发送者）
    const conversationLabel = isGroup
      ? (groupInfo?.groupName ?? `group:${roomId}`)
      : senderLabel;

    // 构造消息上下文（参考 Telegram/Slack 插件的 finalizeInboundContext 参数）
    const rawCtx: Record<string, unknown> = {
      Body: bodyWithSender,
      BodyForAgent: bodyForAgent,
      RawBody: text,
      CommandBody: text,
      BodyForCommands: text,
      From: isGroup
        ? `rocketchat:group:${roomId}:${senderUsername}`
        : `rocketchat:${senderUsername}`,
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
      ConversationLabel: conversationLabel,
      CommandAuthorized: true,
      MessageSid: messageId,
      SenderId: senderId,
      SenderName: senderDisplayName,
      SenderUsername: senderUsername,
      Timestamp: Date.now(),
      // 群组消息：是否被 @提及（参考 Telegram/Slack 的 WasMentioned 字段）
      WasMentioned: isGroup ? wasMentioned : undefined,
      // 回复上下文：引用的消息 ID（Rocket.Chat 的 tmid 字段）
      ReplyToId: tmid || undefined,
    };

    // 群组消息额外字段
    if (isGroup && groupInfo) {
      rawCtx.GroupSubject = groupInfo.groupName;
    }

    // 群组历史上下文（参考 Telegram/Slack 的 InboundHistory）
    if (isGroup) {
      const history = this.getAndClearGroupHistory(roomId);
      if (history.length > 0) {
        rawCtx.InboundHistory = history;
      }
    }

    // 1. 规范化上下文（如果 runtime 提供了 finalizeInboundContext）
    let ctxPayload: Record<string, unknown>;
    if (typeof replyApi.finalizeInboundContext === "function") {
      ctxPayload = replyApi.finalizeInboundContext(rawCtx);
    } else {
      ctxPayload = rawCtx;
    }

    // 2. 创建回复分发器
    let dispatcher: unknown;
    let replyOptions: Record<string, unknown> = {};
    let markDispatchIdle: (() => void) | undefined;
    let hasReplied = false;

    if (typeof replyApi.createReplyDispatcherWithTyping === "function") {
      // 使用 runtime 提供的标准分发器（带 typing 指示器等增强功能）
      const result = replyApi.createReplyDispatcherWithTyping({
        deliver: async (
          payload: { text?: string; mediaUrl?: string },
          info: { kind: string },
        ) => {
          const replyText = payload.text?.trim() ?? "";
          if (!replyText) return;
          hasReplied = true;
          try {
            await this.handleOutbound(replyText, botUsername, roomId);
          } catch (err) {
            this.logger.error(
              `回复发送失败: ${(err as Error).message}`,
            );
          }
        },
        onError: (err: unknown) => {
          this.logger.error(
            `Agent 处理错误: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
        onReplyStart: async () => {
          // 发送 "正在输入..." 指示器到 Rocket.Chat
          await this.botManager.sendTyping(botUsername, roomId, true).catch(() => {});
        },
      });
      dispatcher = result.dispatcher;
      replyOptions = result.replyOptions || {};
      markDispatchIdle = result.markDispatchIdle;
    } else {
      // 兜底：手动构造最小 dispatcher
      this.logger.info("createReplyDispatcherWithTyping 不可用，使用兜底 dispatcher");
      dispatcher = {
        sendFinalReply: async (payload: { text?: string }) => {
          const replyText = payload.text?.trim() ?? "";
          if (!replyText) return;
          hasReplied = true;
          await this.handleOutbound(replyText, botUsername, roomId);
        },
        sendBlockReply: async (payload: { text?: string }) => {
          const replyText = payload.text?.trim() ?? "";
          if (!replyText) return;
          hasReplied = true;
          await this.handleOutbound(replyText, botUsername, roomId);
        },
        sendToolResult: async () => {},
        waitForIdle: async () => {},
        markComplete: () => {},
      };
    }

    // 3. 分发入站消息 → Agent 处理 → 回复通过 deliver 回调发送
    try {
      await replyApi.dispatchReplyFromConfig({
        ctx: ctxPayload,
        cfg,
        dispatcher,
        replyOptions,
      });
    } finally {
      markDispatchIdle?.();
    }

    if (!hasReplied) {
      this.logger.info(`Agent 处理完成，无回复内容（可能是命令或空响应）`);
    }
  }

  // ----------------------------------------------------------
  // ! 命令拦截
  // ----------------------------------------------------------

  /**
   * 拦截 ! 命令和自然语言命令
   *
   * 返回三种动作之一：
   * - reply：由插件本地处理，直接回复（如 !help）
   * - transform：转换文本后继续传给 Agent（如 !reset → /reset）
   * - passthrough：非命令消息，原样传递
   */
  private interceptCommand(text: string): {
    action: "reply" | "transform" | "passthrough";
    replyText?: string;
    transformedText?: string;
  } {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. 检查自然语言命令（精确匹配，避免误伤正常对话）
    const nlCmd = NATURAL_LANGUAGE_COMMANDS[lower];
    if (nlCmd) {
      // 自然语言命中 → 当作 !command 处理
      return this.handleBangCommand(nlCmd, "");
    }

    // 2. 检查 ! 前缀命令
    if (trimmed.startsWith(CMD_PREFIX)) {
      const withoutPrefix = trimmed.slice(CMD_PREFIX.length).trim();
      if (!withoutPrefix) {
        // 只输入了 "!" → 显示帮助
        return { action: "reply", replyText: buildHelpText() };
      }
      const spaceIdx = withoutPrefix.indexOf(" ");
      const cmdName = spaceIdx >= 0 ? withoutPrefix.slice(0, spaceIdx) : withoutPrefix;
      const cmdArgs = spaceIdx >= 0 ? withoutPrefix.slice(spaceIdx + 1).trim() : "";
      return this.handleBangCommand(cmdName.toLowerCase(), cmdArgs);
    }

    // 3. 非命令消息
    return { action: "passthrough" };
  }

  /**
   * 处理具体的 ! 命令
   * @param cmd 命令名（不含 ! 前缀，已小写）
   * @param args 命令参数
   */
  private handleBangCommand(
    cmd: string,
    args: string,
  ): {
    action: "reply" | "transform" | "passthrough";
    replyText?: string;
    transformedText?: string;
  } {
    // 本地处理的命令
    if (cmd === "help") {
      return { action: "reply", replyText: buildHelpText() };
    }

    // 转换为 /command 传给 OpenClaw Gateway 处理
    const slashCmd = args ? `/${cmd} ${args}` : `/${cmd}`;
    return { action: "transform", transformedText: slashCmd };
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
  // 内部：群组消息历史（InboundHistory）
  // ----------------------------------------------------------

  /**
   * 记录被跳过的群组消息（未触发 Agent 的消息）到历史
   * 当 Agent 被 @提及时，这些历史会作为 InboundHistory 传递，
   * 让 Agent 了解群组中最近的对话上下文（参考 Telegram 的做法）
   */
  private recordGroupHistory(roomId: string, msg: RcMessage): void {
    if (!this.groupRooms.has(roomId)) return;

    const senderName = msg.u.name || msg.u.username;
    const senderUsername = msg.u.username;
    const senderLabel = senderName !== senderUsername
      ? `${senderName} (@${senderUsername})`
      : `@${senderUsername}`;

    const entry: HistoryEntry = {
      sender: senderLabel,
      body: msg.msg || "",
      timestamp: Date.now(),
    };

    let history = this.groupHistories.get(roomId);
    if (!history) {
      history = [];
      this.groupHistories.set(roomId, history);
    }

    history.push(entry);

    // 限制历史条目数
    if (history.length > MAX_GROUP_HISTORY_ENTRIES) {
      history.splice(0, history.length - MAX_GROUP_HISTORY_ENTRIES);
    }
  }

  /**
   * 获取并清空群组消息历史
   * 在分发到 Agent 后调用，避免重复传递
   */
  private getAndClearGroupHistory(roomId: string): HistoryEntry[] {
    const history = this.groupHistories.get(roomId) || [];
    this.groupHistories.delete(roomId);
    return history;
  }

  // ----------------------------------------------------------
  // 内部：@提及 判断
  // ----------------------------------------------------------

  /**
   * 判断机器人是否应该响应该消息，同时返回提及状态
   *
   * DM 消息：始终响应（roomId 不在 groupRooms 中）
   * 群组消息：
   *   1. 过滤广播提及（@here / @all / @everyone）—— 仅广播提及时不响应
   *   2. 如果群组配置了 requireMention，只有直接 @机器人 才响应
   *   3. 如果未配置 requireMention，除了广播提及外都响应
   */
  private checkRespond(
    msg: RcMessage,
    botUsername: string,
    roomId: string,
  ): { shouldRespond: boolean; wasMentioned: boolean } {
    const groupInfo = this.groupRooms.get(roomId);

    // DM 消息：始终响应
    if (!groupInfo) {
      return { shouldRespond: true, wasMentioned: false };
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
      return { shouldRespond: false, wasMentioned: false };
    }

    // 如果群组要求 @提及 才响应
    if (groupInfo.requireMention && !isBotMentioned) {
      return { shouldRespond: false, wasMentioned: false };
    }

    return { shouldRespond: true, wasMentioned: isBotMentioned };
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
