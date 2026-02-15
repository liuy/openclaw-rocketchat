// ============================================================
// 频道后台服务主逻辑
// Gateway 启动时自动运行：连接 RC、管理机器人、桥接消息
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { BotManager } from "./bot-manager.js";
import { MessageHandler } from "./message-handler.js";
import {
  loadAdminCredentials,
  loadBotCredentials,
} from "../config/credentials.js";
import type { RocketchatChannelConfig, OpenClawBinding } from "../rc-api/types.js";

interface ChannelServiceOptions {
  config: Partial<RocketchatChannelConfig>;
  bindings?: OpenClawBinding[];
  logger?: { info: (msg: string) => void; error: (msg: string) => void };
  /** OpenClaw Plugin Runtime（由 api.runtime 提供，包含消息分发等核心 API） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runtime?: any;
}

export class ChannelService {
  private config: Partial<RocketchatChannelConfig>;
  private bindings: OpenClawBinding[];
  private botManager: BotManager | null = null;
  private messageHandler: MessageHandler | null = null;
  private adminClient: RocketChatRestClient | null = null;
  /** OpenClaw Plugin Runtime */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private runtime: any;
  private logger: { info: (msg: string) => void; error: (msg: string) => void };
  private running = false;

  constructor(options: ChannelServiceOptions) {
    this.config = options.config;
    this.bindings = options.bindings || [];
    this.runtime = options.runtime || null;
    this.logger = options.logger || {
      info: (msg: string) => console.log(`[RC ChannelService] ${msg}`),
      error: (msg: string) => console.error(`[RC ChannelService] ${msg}`),
    };
  }

  // ----------------------------------------------------------
  // 生命周期
  // ----------------------------------------------------------

  /** 启动服务 */
  async start(): Promise<void> {
    if (this.running) return;

    if (!this.config.enabled) {
      this.logger.info("Rocket.Chat 插件未启用，跳过启动");
      return;
    }

    if (!this.config.serverUrl) {
      this.logger.error("未配置 serverUrl，无法启动");
      return;
    }

    this.logger.info(`正在连接 Rocket.Chat: ${this.config.serverUrl}`);

    // 1. 验证管理员连接
    const adminCreds = await loadAdminCredentials();
    if (!adminCreds) {
      this.logger.error("未找到管理员凭据，请先运行 setup");
      return;
    }

    this.adminClient = new RocketChatRestClient(this.config.serverUrl);
    this.adminClient.setAuth(adminCreds.userId, adminCreds.authToken);

    try {
      await this.adminClient.serverInfo();
      this.logger.info("Rocket.Chat 服务器连接成功");
    } catch (err) {
      this.logger.error(
        `无法连接 Rocket.Chat: ${(err as Error).message}`,
      );
      return;
    }

    // 2. 验证 Plugin Runtime
    if (this.runtime?.channel?.reply) {
      this.logger.info("Plugin Runtime 已就绪（通过 api.runtime 获取）");
    } else {
      this.logger.error(
        "Plugin Runtime 不可用，入站消息将无法路由到 Agent",
      );
    }

    // 3. 初始化 BotManager
    this.botManager = new BotManager(this.config.serverUrl, this.logger);

    // 4. 初始化 MessageHandler
    this.messageHandler = new MessageHandler({
      botManager: this.botManager,
      config: this.config,
      logger: this.logger,
      runtime: this.runtime,
    });

    // 5. 设置消息回调
    this.botManager.onMessage((msg, roomId, botUsername, agentId) => {
      this.messageHandler!.handleInbound(msg, roomId, botUsername, agentId);
    });

    // 6. 连接所有机器人
    await this.connectBots();

    // 7. 确保所有群组存在并订阅
    await this.ensureGroups();

    this.running = true;
    this.logger.info("Rocket.Chat 频道服务已启动");
  }

  /** 停止服务 */
  stop(): void {
    if (!this.running) return;

    this.botManager?.disconnectAll();
    this.running = false;
    this.logger.info("Rocket.Chat 频道服务已停止");
  }

  /** 获取 MessageHandler（用于出站消息） */
  getMessageHandler(): MessageHandler | null {
    return this.messageHandler;
  }

  /** 获取 BotManager */
  getBotManager(): BotManager | null {
    return this.botManager;
  }

  // ----------------------------------------------------------
  // 内部：连接机器人
  // ----------------------------------------------------------

  private async connectBots(): Promise<void> {
    const accounts = this.config.accounts || {};
    const botCreds = await loadBotCredentials();

    for (const [accountId, account] of Object.entries(accounts)) {
      const creds = botCreds[account.botUsername];
      if (!creds) {
        this.logger.error(
          `机器人 ${account.botUsername} 无凭据，跳过`,
        );
        continue;
      }

      try {
        // 从 bindings 中查找该 account 绑定的 agentId
        const binding = this.bindings.find(
          (b) => b.match?.channel === "rocketchat" && b.match?.accountId === accountId,
        );
        const agentId = binding?.agentId || accountId;

        await this.botManager!.addBot(
          account.botUsername,
          creds.password,
          creds.userId,
          agentId,
          account.botDisplayName,
        );

        // 订阅该机器人所有相关的 DM
        await this.subscribeBotDMs(account.botUsername);
      } catch (err) {
        this.logger.error(
          `机器人 ${account.botUsername} 启动失败: ${(err as Error).message}`,
        );
      }
    }
  }

  /** 订阅机器人的所有 DM */
  private async subscribeBotDMs(botUsername: string): Promise<void> {
    const restClient = this.botManager!.getRestClient(botUsername);
    if (!restClient) return;

    try {
      const dms = await restClient.listDirectMessages();
      for (const dm of dms) {
        await this.botManager!.subscribeRoom(botUsername, dm._id);
      }
    } catch (err) {
      this.logger.error(
        `${botUsername}: 获取 DM 列表失败: ${(err as Error).message}`,
      );
    }
  }

  // ----------------------------------------------------------
  // 内部：确保群组存在
  // ----------------------------------------------------------

  private async ensureGroups(): Promise<void> {
    const groups = this.config.groups || {};

    for (const [groupName, groupConfig] of Object.entries(groups)) {
      try {
        // 检查群组是否存在
        const groupInfo = await this.adminClient!.getGroupInfo(
          undefined,
          groupName,
        );

        if (groupInfo) {
          // 注册群组房间信息到 MessageHandler（用于区分 DM/群组 + @提及过滤）
          this.messageHandler?.registerGroupRoom(groupInfo._id, {
            groupName,
            requireMention: groupConfig.requireMention ?? false,
            bots: groupConfig.bots || [],
          });

          // 群组存在，为其中的每个机器人订阅消息
          for (const botUsername of groupConfig.bots || []) {
            await this.botManager!.subscribeRoom(botUsername, groupInfo._id);
          }
        } else {
          this.logger.error(
            `群组「${groupName}」不存在！请运行: openclaw rocketchat add-group`,
          );
        }
      } catch (err) {
        this.logger.error(
          `检查群组「${groupName}」失败: ${(err as Error).message}`,
        );
      }
    }
  }
}
