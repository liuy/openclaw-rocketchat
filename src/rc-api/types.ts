// ============================================================
// Rocket.Chat API 类型定义
// ============================================================

/** 登录结果 */
export interface AuthResult {
  userId: string;
  authToken: string;
}

/** 用户信息 */
export interface RcUser {
  _id: string;
  username: string;
  name?: string;
  emails?: { address: string; verified: boolean }[];
  roles?: string[];
  active?: boolean;
  type?: string;
  status?: string;
}

/** 房间/频道信息 */
export interface RcRoom {
  _id: string;
  name?: string;
  fname?: string;
  t: "d" | "p" | "c" | "l"; // d=DM, p=private, c=channel, l=livechat
  usernames?: string[];
  usersCount?: number;
  msgs?: number;
  lm?: string; // last message timestamp
}

/** 房间成员 */
export interface RcMember {
  _id: string;
  username: string;
  name?: string;
  roles?: string[];
  status?: string;
}

/** 消息 */
export interface RcMessage {
  _id: string;
  rid: string; // room id
  msg: string;
  ts: { $date: number } | string;
  u: {
    _id: string;
    username: string;
    name?: string;
  };
  mentions?: { _id: string; username: string }[];
  attachments?: RcAttachment[];
  file?: {
    _id: string;
    name: string;
    type: string;
  };
  t?: string; // message type (system messages, etc.)
}

/** 附件 */
export interface RcAttachment {
  title?: string;
  title_link?: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  type?: string;
  description?: string;
}

/** 创建用户参数 */
export interface CreateUserParams {
  name: string;
  email: string;
  password: string;
  username: string;
  roles?: string[];
  joinDefaultChannels?: boolean;
  verified?: boolean;
  requirePasswordChange?: boolean;
}

/** 发送消息选项 */
export interface SendMessageOptions {
  alias?: string;
  emoji?: string;
  avatar?: string;
  attachments?: RcAttachment[];
}

/** 服务器信息 */
export interface ServerInfo {
  version: string;
  success: boolean;
}

/** 凭据存储 - 管理员 */
export interface AdminCredentials {
  userId: string;
  authToken: string;
  username: string;
  password: string;
}

/** 凭据存储 - 机器人 */
export interface BotCredentials {
  [botUsername: string]: {
    userId: string;
    password: string;
  };
}

/** 凭据存储 - 用户 */
export interface UserRecord {
  username: string;
  createdAt: string;
  /** 权限：full = 全功能（默认），readonly = 只读（禁言、无 DM） */
  permission?: "full" | "readonly";
}

/** 插件配置（channels.rocketchat 下的结构） */
export interface RocketchatChannelConfig {
  enabled: boolean;
  serverUrl: string;
  port: number;
  dmPolicy: "pairing" | "allowlist" | "open";
  accounts: {
    [accountId: string]: {
      botUsername: string;
      botDisplayName?: string;
    };
  };
  groups: {
    [groupName: string]: {
      requireMention: boolean;
      bots: string[];
    };
  };
}

/** OpenClaw Agent 信息 */
export interface OpenClawAgent {
  id: string;
  name?: string;
  default?: boolean;
}

/** OpenClaw binding 信息 */
export interface OpenClawBinding {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: string;
  };
}
