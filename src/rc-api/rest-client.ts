// ============================================================
// Rocket.Chat REST API 客户端
// 基于原生 fetch，不依赖第三方 HTTP 库
// ============================================================

import type {
  AuthResult,
  RcUser,
  RcRoom,
  RcMember,
  RcMessage,
  CreateUserParams,
  SendMessageOptions,
  ServerInfo,
} from "./types.js";

/** 请求重试配置 */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

export class RocketChatRestClient {
  private serverUrl: string;
  private userId = "";
  private authToken = "";

  constructor(serverUrl: string) {
    // 去掉末尾斜杠
    this.serverUrl = serverUrl.replace(/\/+$/, "");

    // ⚠️  SECURITY: 禁用 TLS 证书验证
    // 原因：同机部署时 serverUrl 为 https://127.0.0.1，使用 sslip.io 域名证书，
    //       证书的 CN/SAN 不匹配 127.0.0.1 会导致连接失败。
    //       分离部署虽有正式证书，但也可能使用自定义证书。
    // 影响范围：仅影响此 Node.js 进程内的 HTTPS 请求。
    // 替代方案：将来可为本地连接使用 --ca 选项或信任自签 CA。
    if (this.serverUrl.startsWith("https://")) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  // ----------------------------------------------------------
  // 内部：HTTP 请求封装
  // ----------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isFormData = false,
  ): Promise<T> {
    const url = `${this.serverUrl}/api/v1${path}`;
    const headers: Record<string, string> = {};

    if (this.authToken && this.userId) {
      headers["X-Auth-Token"] = this.authToken;
      headers["X-User-Id"] = this.userId;
    }

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: isFormData
            ? (body as BodyInit)
            : body
              ? JSON.stringify(body)
              : undefined,
        });

        // HTTP 429 Too Many Requests — 退避重试
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const waitMs = Number.isFinite(parsed) && parsed > 0
            ? parsed * 1000
            : RETRY_BASE_MS * Math.pow(2, attempt);
          await this.sleep(waitMs);
          continue;
        }

        let data: T & { success?: boolean; error?: string; message?: string };
        try {
          data = (await response.json()) as T & {
            success?: boolean;
            error?: string;
            message?: string;
          };
        } catch {
          throw new Error(
            `Rocket.Chat API error: 响应不是有效 JSON (HTTP ${response.status} ${method} ${path})`,
          );
        }

        if (!response.ok || data.success === false) {
          const msg =
            data.error || data.message || `HTTP ${response.status}`;
          throw new Error(`Rocket.Chat API error: ${msg} (${method} ${path})`);
        }

        return data;
      } catch (err) {
        lastError = err as Error;

        // 网络错误才重试，逻辑错误不重试
        if (
          (err as Error).message?.includes("Rocket.Chat API error") ||
          attempt === MAX_RETRIES
        ) {
          break;
        }

        await this.sleep(RETRY_BASE_MS * Math.pow(2, attempt));
      }
    }

    throw lastError || new Error("Request failed");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ----------------------------------------------------------
  // 认证
  // ----------------------------------------------------------

  /** 设置已有的认证信息（从凭据文件读取时使用） */
  setAuth(userId: string, authToken: string): void {
    this.userId = userId;
    this.authToken = authToken;
  }

  /** 登录获取 token */
  async login(user: string, password: string): Promise<AuthResult> {
    const res = await this.request<{
      data: { userId: string; authToken: string };
    }>("POST", "/login", { user, password });

    this.userId = res.data.userId;
    this.authToken = res.data.authToken;

    return { userId: res.data.userId, authToken: res.data.authToken };
  }

  // ----------------------------------------------------------
  // 用户管理
  // ----------------------------------------------------------

  /** 创建用户 */
  async createUser(params: CreateUserParams): Promise<RcUser> {
    const res = await this.request<{ user: RcUser }>("POST", "/users.create", {
      name: params.name,
      email: params.email,
      password: params.password,
      username: params.username,
      roles: params.roles || ["user"],
      joinDefaultChannels:
        params.joinDefaultChannels !== undefined
          ? params.joinDefaultChannels
          : false,
      verified: params.verified !== undefined ? params.verified : true,
      requirePasswordChange:
        params.requirePasswordChange !== undefined
          ? params.requirePasswordChange
          : false,
    });
    return res.user;
  }

  /** 查询用户信息 */
  async getUserInfo(username: string): Promise<RcUser | null> {
    try {
      const res = await this.request<{ user: RcUser }>(
        "GET",
        `/users.info?username=${encodeURIComponent(username)}`,
      );
      return res.user;
    } catch {
      return null;
    }
  }

  /** 列出所有用户 */
  async listUsers(): Promise<RcUser[]> {
    const res = await this.request<{ users: RcUser[] }>(
      "GET",
      "/users.list?count=200",
    );
    return res.users;
  }

  /** 删除用户 */
  async deleteUser(userId: string, confirmRelinquish = true): Promise<void> {
    await this.request("POST", "/users.delete", {
      userId,
      confirmRelinquish,
    });
  }

  // ----------------------------------------------------------
  // DM 私聊
  // ----------------------------------------------------------

  /** 创建 DM 通道 */
  async createDirectMessage(usernames: string[]): Promise<RcRoom> {
    const res = await this.request<{ room: RcRoom }>("POST", "/im.create", {
      usernames: usernames.join(","),
    });
    return res.room;
  }

  /** 列出 DM */
  async listDirectMessages(): Promise<RcRoom[]> {
    const res = await this.request<{ ims: RcRoom[] }>(
      "GET",
      "/im.list?count=200",
    );
    return res.ims;
  }

  // ----------------------------------------------------------
  // 私有频道（Groups）
  // ----------------------------------------------------------

  /** 创建私有频道 */
  async createGroup(name: string, members?: string[], displayName?: string): Promise<RcRoom> {
    const res = await this.request<{ group: RcRoom }>(
      "POST",
      "/groups.create",
      {
        name,
        members: members || [],
      },
    );

    // 如果有中文显示名，设置频道的 fname（显示名称）
    if (displayName && displayName !== name) {
      try {
        await this.request("POST", "/groups.setCustomFields", {
          roomId: res.group._id,
          customFields: { displayName },
        });
      } catch {
        // 忽略
      }
      try {
        // groups.rename 设置 fname
        await this.request("POST", "/groups.rename", {
          roomId: res.group._id,
          name: displayName,
        });
      } catch {
        // RC 可能不允许中文 rename，尝试 topic 作为备选
        try {
          await this.request("POST", "/groups.setTopic", {
            roomId: res.group._id,
            topic: displayName,
          });
        } catch {
          // 不影响主流程
        }
      }
    }

    return res.group;
  }

  /** 查询频道信息 */
  async getGroupInfo(
    roomId?: string,
    roomName?: string,
  ): Promise<RcRoom | null> {
    try {
      const query = roomId
        ? `roomId=${encodeURIComponent(roomId)}`
        : `roomName=${encodeURIComponent(roomName || "")}`;
      const res = await this.request<{ group: RcRoom }>(
        "GET",
        `/groups.info?${query}`,
      );
      return res.group;
    } catch {
      return null;
    }
  }

  /** 查询公开频道信息 */
  async getChannelInfo(roomName: string): Promise<RcRoom | null> {
    try {
      const res = await this.request<{ channel: RcRoom }>(
        "GET",
        `/channels.info?roomName=${encodeURIComponent(roomName)}`,
      );
      return res.channel;
    } catch {
      return null;
    }
  }

  /** 删除公开频道 */
  async deleteChannel(roomId: string): Promise<void> {
    await this.request("POST", "/channels.delete", { roomId });
  }

  /** 列出所有私有频道 */
  async listGroups(): Promise<RcRoom[]> {
    const res = await this.request<{ groups: RcRoom[] }>(
      "GET",
      "/groups.listAll?count=200",
    );
    return res.groups;
  }

  /** 列出频道成员 */
  async getGroupMembers(roomId: string): Promise<RcMember[]> {
    const res = await this.request<{ members: RcMember[] }>(
      "GET",
      `/groups.members?roomId=${encodeURIComponent(roomId)}&count=200`,
    );
    return res.members;
  }

  /** 邀请用户进群 */
  async groupInvite(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.invite", { roomId, userId });
  }

  /** 移除成员 */
  async groupKick(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.kick", { roomId, userId });
  }

  /** 设为所有者 */
  async groupAddOwner(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.addOwner", { roomId, userId });
  }

  /** 设为管理员 */
  async groupAddModerator(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.addModerator", { roomId, userId });
  }

  /** 在房间中禁言用户 */
  async muteUserInRoom(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/rooms.muteUser", { roomId, userId });
  }

  /** 在房间中取消禁言 */
  async unmuteUserInRoom(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/rooms.unmuteUser", { roomId, userId });
  }

  /** 移除所有者 */
  async groupRemoveOwner(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.removeOwner", { roomId, userId });
  }

  /** 移除管理员 */
  async groupRemoveModerator(roomId: string, userId: string): Promise<void> {
    await this.request("POST", "/groups.removeModerator", { roomId, userId });
  }

  /** 删除频道 */
  async deleteGroup(roomId: string): Promise<void> {
    await this.request("POST", "/groups.delete", { roomId });
  }

  // ----------------------------------------------------------
  // 消息
  // ----------------------------------------------------------

  /** 发送消息 */
  async sendMessage(
    roomId: string,
    text: string,
    options?: SendMessageOptions,
  ): Promise<RcMessage> {
    const res = await this.request<{ message: RcMessage }>(
      "POST",
      "/chat.sendMessage",
      {
        message: {
          rid: roomId,
          msg: text,
          ...options,
        },
      },
    );
    return res.message;
  }

  /** 上传文件到房间 */
  async uploadFile(
    roomId: string,
    fileBuffer: Buffer,
    filename: string,
    description?: string,
  ): Promise<void> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    formData.append("file", blob, filename);
    if (description) {
      formData.append("description", description);
    }

    await this.request(
      "POST",
      `/rooms.upload/${encodeURIComponent(roomId)}`,
      formData,
      true,
    );
  }

  // ----------------------------------------------------------
  // 服务器
  // ----------------------------------------------------------

  /** 修改服务器设置（需要 admin 权限） */
  async setSetting(settingId: string, value: unknown): Promise<void> {
    await this.request("POST", `/settings/${encodeURIComponent(settingId)}`, { value });
  }

  /** 获取服务器信息（健康检查，兼容 RC 6.x ~ 8.x） */
  async serverInfo(): Promise<ServerInfo> {
    // 方式 1：/api/v1/info（RC 6.x ~ 7.x）
    try {
      const res = await this.request<{ info: { version: string }; success: boolean }>(
        "GET",
        "/info",
      );
      return { version: res.info?.version || "unknown", success: true };
    } catch {
      // 继续尝试其他方式
    }

    // 方式 2：/api/info（不带 /v1，部分 RC 版本支持）
    try {
      const res = await fetch(`${this.serverUrl}/api/info`);
      if (res.ok) {
        const data = (await res.json()) as { version?: string; info?: { version?: string } };
        const ver = data.version || data.info?.version;
        if (ver) return { version: ver, success: true };
      }
    } catch {
      // 继续
    }

    // 方式 3：/api/v1/login 探测连通性（RC 8.x）
    const loginUrl = `${this.serverUrl}/api/v1/login`;
    const response = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "", password: "" }),
    });
    await response.json(); // 只要返回 JSON 就算连通

    // 尝试从根页面 HTML 的 __meteor_runtime_config__ 提取版本
    let version = "unknown";
    try {
      const html = await (await fetch(this.serverUrl)).text();
      // RC 在 script 中嵌入 __meteor_runtime_config__，包含 "ROOT_URL_PATH_PREFIX" 和版本等
      // 匹配常见的版本模式
      const meteorMatch = html.match(/__meteor_runtime_config__\s*=\s*JSON\.parse\(decodeURIComponent\("([^"]+)"\)\)/);
      if (meteorMatch) {
        try {
          const config = JSON.parse(decodeURIComponent(meteorMatch[1])) as Record<string, unknown>;
          // autoupdateVersion 或 autoupdateVersionCordova 包含版本哈希，不一定是语义版本
          // 尝试从嵌套结构中提取
          const configStr = JSON.stringify(config);
          const verMatch = configStr.match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/);
          if (verMatch) version = verMatch[1];
        } catch {
          // 解码失败
        }
      }
      // 兜底：直接在 HTML 中搜索 x.y.z 格式的版本号
      if (version === "unknown") {
        const simpleMatch = html.match(/Rocket\.Chat\s+(?:Version:?\s*)?(\d+\.\d+\.\d+)/i);
        if (simpleMatch) version = simpleMatch[1];
      }
    } catch {
      // 版本获取不影响功能
    }

    return { version, success: true };
  }

  /** 获取服务器版本号（连通性测试用） */
  async getServerVersion(): Promise<string> {
    const info = await this.serverInfo();
    return info.version;
  }

  /** 获取当前服务器 URL */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /** 获取当前认证的 userId */
  getUserId(): string {
    return this.userId;
  }
}
