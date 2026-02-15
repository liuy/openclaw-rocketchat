// ============================================================
// 多机器人连接管理器
// 每个机器人一个 WebSocket 连接，管理所有 DM 和群组的消息订阅
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { RocketChatWsClient } from "../rc-api/ws-client.js";
import type { RcMessage, BotCredentials } from "../rc-api/types.js";

/** 单个机器人的连接状态 */
interface BotConnection {
  username: string;
  displayName?: string;
  agentId: string;
  restClient: RocketChatRestClient;
  wsClient: RocketChatWsClient;
  subscribedRooms: Set<string>;
  connected: boolean;
}

type IncomingMessageHandler = (
  message: RcMessage,
  roomId: string,
  botUsername: string,
  agentId: string,
) => void;

export class BotManager {
  private serverUrl: string;
  private bots = new Map<string, BotConnection>();
  private messageHandler: IncomingMessageHandler | null = null;
  private logger: { info: (msg: string) => void; error: (msg: string) => void };

  constructor(
    serverUrl: string,
    logger?: { info: (msg: string) => void; error: (msg: string) => void },
  ) {
    this.serverUrl = serverUrl;
    this.logger = logger || {
      info: (msg: string) => console.log(`[RC BotManager] ${msg}`),
      error: (msg: string) => console.error(`[RC BotManager] ${msg}`),
    };
  }

  /** 设置消息回调 */
  onMessage(handler: IncomingMessageHandler): void {
    this.messageHandler = handler;
  }

  // ----------------------------------------------------------
  // 机器人生命周期
  // ----------------------------------------------------------

  /** 添加并连接一个机器人（支持密码登录或 authToken 登录） */
  async addBot(
    username: string,
    password: string | undefined,
    userId: string,
    agentId: string,
    displayName?: string,
    authToken?: string,
  ): Promise<void> {
    if (this.bots.has(username)) {
      this.logger.info(`机器人 ${username} 已连接，跳过`);
      return;
    }

    const restClient = new RocketChatRestClient(this.serverUrl);
    const wsClient = new RocketChatWsClient(this.serverUrl);

    const conn: BotConnection = {
      username,
      displayName,
      agentId,
      restClient,
      wsClient,
      subscribedRooms: new Set(),
      connected: false,
    };

    this.bots.set(username, conn);

    // 连接 WebSocket
    try {
      await wsClient.connect();

      if (authToken) {
        // Token 模式：直接使用已有的 userId + authToken
        await wsClient.loginWithToken(authToken);
        restClient.setAuth(userId, authToken);
      } else if (password) {
        // 密码模式：先登录获取 token
        await wsClient.login(username, password);
        const authResult = await restClient.login(username, password);
        restClient.setAuth(authResult.userId, authResult.authToken);
      } else {
        throw new Error(`机器人 ${username} 无可用凭据（password 和 authToken 均为空）`);
      }

      conn.connected = true;

      // 监听消息
      wsClient.onMessage((msg, roomId) => {
        this.handleIncomingMessage(msg, roomId, username, agentId);
      });

      // 监听连接状态
      wsClient.onConnectionChange((connected) => {
        conn.connected = connected;
        if (connected) {
          this.logger.info(`机器人 ${username} 已重新连接`);
        } else {
          this.logger.info(`机器人 ${username} 连接断开，等待重连...`);
        }
      });

      this.logger.info(`机器人 ${username} 已连接`);
    } catch (err) {
      this.logger.error(
        `机器人 ${username} 连接失败: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /** 订阅房间消息 */
  async subscribeRoom(botUsername: string, roomId: string): Promise<void> {
    const conn = this.bots.get(botUsername);
    if (!conn) {
      throw new Error(`机器人 ${botUsername} 未找到`);
    }

    if (conn.subscribedRooms.has(roomId)) {
      return; // 已订阅
    }

    try {
      await conn.wsClient.subscribeRoomMessages(roomId);
      conn.subscribedRooms.add(roomId);
      this.logger.info(`${botUsername}: 已订阅房间 ${roomId}`);
    } catch (err) {
      this.logger.error(
        `${botUsername}: 订阅房间 ${roomId} 失败: ${(err as Error).message}`,
      );
    }
  }

  /** 通过机器人发送消息 */
  async sendMessage(
    botUsername: string,
    roomId: string,
    text: string,
    options?: { tmid?: string },
  ): Promise<void> {
    const conn = this.bots.get(botUsername);
    if (!conn) {
      throw new Error(`机器人 ${botUsername} 未找到`);
    }

    await conn.restClient.sendMessage(roomId, text, options);
  }

  /** 通过机器人上传文件 */
  async uploadFile(
    botUsername: string,
    roomId: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<void> {
    const conn = this.bots.get(botUsername);
    if (!conn) {
      throw new Error(`机器人 ${botUsername} 未找到`);
    }

    await conn.restClient.uploadFile(roomId, fileBuffer, filename);
  }

  /** 发送正在输入状态 */
  async sendTyping(
    botUsername: string,
    roomId: string,
    typing: boolean,
  ): Promise<void> {
    const conn = this.bots.get(botUsername);
    if (!conn?.connected) return;
    await conn.wsClient.sendTyping(roomId, botUsername, typing);
  }

  /** 获取机器人的 REST 客户端 */
  getRestClient(botUsername: string): RocketChatRestClient | undefined {
    return this.bots.get(botUsername)?.restClient;
  }

  /** 获取所有已连接的机器人名 */
  getConnectedBots(): string[] {
    return [...this.bots.entries()]
      .filter(([, conn]) => conn.connected)
      .map(([username]) => username);
  }

  /** 获取机器人绑定的 Agent ID */
  getAgentId(botUsername: string): string | undefined {
    return this.bots.get(botUsername)?.agentId;
  }

  /** 断开所有机器人 */
  disconnectAll(): void {
    for (const [username, conn] of this.bots) {
      try {
        conn.wsClient.disconnect();
        this.logger.info(`机器人 ${username} 已断开`);
      } catch {
        // 忽略断开错误
      }
    }
    this.bots.clear();
  }

  // ----------------------------------------------------------
  // 内部：消息处理
  // ----------------------------------------------------------

  private handleIncomingMessage(
    msg: RcMessage,
    roomId: string,
    botUsername: string,
    agentId: string,
  ): void {
    // 忽略机器人自己发的消息
    if (msg.u?.username === botUsername) {
      return;
    }

    // 忽略所有已注册机器人发的消息（防止群组中机器人互相触发）
    if (this.bots.has(msg.u?.username)) {
      return;
    }

    // 忽略系统消息
    if (msg.t) {
      return;
    }

    if (this.messageHandler) {
      try {
        this.messageHandler(msg, roomId, botUsername, agentId);
      } catch (err) {
        this.logger.error(
          `消息处理错误: ${(err as Error).message}`,
        );
      }
    }
  }
}
