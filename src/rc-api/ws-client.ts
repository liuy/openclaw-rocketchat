// ============================================================
// Rocket.Chat WebSocket (DDP) 客户端
// 实时消息订阅，自动重连
// ============================================================

import WebSocket from "ws";
import type { RcMessage } from "./types.js";

/** DDP 消息结构 */
interface DdpMessage {
  msg: string;
  id?: string;
  method?: string;
  params?: unknown[];
  result?: unknown;
  error?: unknown;
  name?: string;
  collection?: string;
  fields?: {
    eventName?: string;
    args?: unknown[];
  };
}

type MessageHandler = (msg: RcMessage, roomId: string) => void;
type ConnectionHandler = (connected: boolean) => void;

/** 重连配置 */
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const PING_TIMEOUT_MS = 10000;

export class RocketChatWsClient {
  private serverUrl: string;
  private ws: WebSocket | null = null;
  private messageCounter = 0;
  private pendingCalls = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private subscriptions = new Map<string, string>(); // subId -> roomId
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  private loginUser = "";
  private loginPassword = "";
  private autoReconnect = true;

  constructor(serverUrl: string) {
    // 转换 http -> ws
    this.serverUrl = serverUrl
      .replace(/^https:/, "wss:")
      .replace(/^http:/, "ws:")
      .replace(/\/+$/, "");
  }

  // ----------------------------------------------------------
  // 连接管理
  // ----------------------------------------------------------

  /** 建立 WebSocket 连接 */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.serverUrl}/websocket`;

      this.ws = new WebSocket(wsUrl, {
        rejectUnauthorized: false, // 兼容 localhost 自回环及用户自定义证书场景
      });

      this.ws.on("open", () => {
        // DDP 握手
        this.sendRaw({
          msg: "connect",
          version: "1",
          support: ["1"],
        });
      });

      this.ws.on("message", (data) => {
        const raw = data.toString();
        if (!raw) return;

        let msg: DdpMessage;
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }

        this.handleDdpMessage(msg, resolve, reject);
      });

      this.ws.on("close", () => {
        this.clearPingTimer();
        // 清理所有等待中的调用，防止永久挂起
        for (const [id, pending] of this.pendingCalls) {
          pending.reject(new Error("WebSocket connection closed"));
        }
        this.pendingCalls.clear();
        this.notifyConnection(false);
        if (this.autoReconnect && !this.disposed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err) => {
        if (!this.reconnecting) {
          reject(err);
        }
      });
    });
  }

  /** DDP 登录 */
  async login(user: string, password: string): Promise<void> {
    this.loginUser = user;
    this.loginPassword = password;

    const result = await this.callMethod("login", [
      {
        user: { username: user },
        password: {
          digest: await this.sha256(password),
          algorithm: "sha-256",
        },
      },
    ]);

    if (!result) {
      throw new Error("Login failed: no result");
    }
  }

  /** 断开连接 */
  disconnect(): void {
    this.disposed = true;
    this.autoReconnect = false;
    this.clearPingTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ----------------------------------------------------------
  // 消息订阅
  // ----------------------------------------------------------

  /** 订阅房间消息 */
  async subscribeRoomMessages(roomId: string): Promise<string> {
    const subId = this.nextId();

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(subId, {
        resolve: () => {
          this.subscriptions.set(subId, roomId);
          resolve(subId);
        },
        reject,
      });

      this.sendRaw({
        msg: "sub",
        id: subId,
        name: "stream-room-messages",
        params: [roomId, false],
      });
    });
  }

  /** 取消订阅 */
  async unsubscribe(subId: string): Promise<void> {
    this.subscriptions.delete(subId);
    this.sendRaw({ msg: "unsub", id: subId });
  }

  // ----------------------------------------------------------
  // 事件监听
  // ----------------------------------------------------------

  /** 监听消息事件 */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /** 监听连接状态变化 */
  onConnectionChange(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  // ----------------------------------------------------------
  // 内部：DDP 协议处理
  // ----------------------------------------------------------

  private handleDdpMessage(
    msg: DdpMessage,
    connectResolve?: (value: void | PromiseLike<void>) => void,
    connectReject?: (reason: unknown) => void,
  ): void {
    switch (msg.msg) {
      case "connected":
        this.reconnectAttempt = 0;
        this.reconnecting = false;
        this.startPingTimer();
        this.notifyConnection(true);
        connectResolve?.();
        break;

      case "ping":
        this.sendRaw({ msg: "pong" });
        break;

      case "pong":
        // 心跳响应，无需处理
        break;

      case "result": {
        const pending = this.pendingCalls.get(msg.id || "");
        if (pending) {
          this.pendingCalls.delete(msg.id || "");
          if (msg.error) {
            pending.reject(
              new Error(
                typeof msg.error === "string"
                  ? msg.error
                  : JSON.stringify(msg.error),
              ),
            );
          } else {
            pending.resolve(msg.result);
          }
        }
        break;
      }

      case "ready": {
        // 订阅就绪
        const subIds = (msg as unknown as { subs: string[] }).subs;
        if (subIds) {
          for (const subId of subIds) {
            const pending = this.pendingCalls.get(subId);
            if (pending) {
              this.pendingCalls.delete(subId);
              pending.resolve(undefined);
            }
          }
        }
        break;
      }

      case "changed": {
        // 实时消息推送
        if (msg.collection === "stream-room-messages" && msg.fields?.args) {
          for (const arg of msg.fields.args) {
            const rcMsg = arg as RcMessage;
            if (rcMsg && rcMsg._id && rcMsg.rid) {
              this.notifyMessage(rcMsg, rcMsg.rid);
            }
          }
        }
        break;
      }

      case "failed":
        connectReject?.(new Error("DDP connection failed"));
        break;
    }
  }

  private async callMethod(method: string, params: unknown[]): Promise<unknown> {
    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.sendRaw({ msg: "method", method, id, params });
    });
  }

  private sendRaw(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private nextId(): string {
    return String(++this.messageCounter);
  }

  // ----------------------------------------------------------
  // 内部：心跳
  // ----------------------------------------------------------

  private startPingTimer(): void {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      this.sendRaw({ msg: "ping" });
    }, PING_TIMEOUT_MS);
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ----------------------------------------------------------
  // 内部：自动重连
  // ----------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnecting) return;
    this.reconnecting = true;

    const delay = Math.min(
      RECONNECT_MIN_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        // 重新登录
        if (this.loginUser && this.loginPassword) {
          await this.login(this.loginUser, this.loginPassword);
        }
        // 重新订阅所有房间
        const rooms = [...this.subscriptions.values()];
        this.subscriptions.clear();
        for (const roomId of rooms) {
          await this.subscribeRoomMessages(roomId);
        }
        // 重连成功，重置状态
        this.reconnecting = false;
        this.reconnectAttempt = 0;
      } catch {
        // 继续重试
        this.reconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ----------------------------------------------------------
  // 内部：事件通知
  // ----------------------------------------------------------

  private notifyMessage(msg: RcMessage, roomId: string): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(msg, roomId);
      } catch {
        // 忽略 handler 错误
      }
    }
  }

  private notifyConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(connected);
      } catch {
        // 忽略 handler 错误
      }
    }
  }

  // ----------------------------------------------------------
  // 工具
  // ----------------------------------------------------------

  private async sha256(text: string): Promise<string> {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(text).digest("hex");
  }
}
