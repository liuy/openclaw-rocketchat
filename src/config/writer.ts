// ============================================================
// OpenClaw 配置读写工具
// 安全读写 openclaw.json，只写入 channels.rocketchat 和 bindings
// ============================================================

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import JSON5 from "json5";
import type {
  RocketchatChannelConfig,
  OpenClawAgent,
  OpenClawBinding,
} from "../rc-api/types.js";

/** openclaw.json 的根结构（部分） */
interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgent[];
  };
  bindings?: OpenClawBinding[];
  channels?: {
    rocketchat?: Partial<RocketchatChannelConfig>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ConfigWriter {
  private configPath: string;
  private config: OpenClawConfig = {};

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  // ----------------------------------------------------------
  // 读取
  // ----------------------------------------------------------

  /** 读取 openclaw.json */
  async readConfig(): Promise<OpenClawConfig> {
    if (!existsSync(this.configPath)) {
      this.config = {};
      return this.config;
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      this.config = JSON5.parse(content);
    } catch (err) {
      throw new Error(
        `无法读取 openclaw.json: ${(err as Error).message}\n路径: ${this.configPath}`,
      );
    }
    return this.config;
  }

  /** 获取已有 Agent 列表（只读） */
  getAgentsList(): OpenClawAgent[] {
    return this.config.agents?.list || [];
  }

  /** 获取 Rocket.Chat 频道配置 */
  getRocketchatConfig(): Partial<RocketchatChannelConfig> | undefined {
    return this.config.channels?.rocketchat;
  }

  /** 获取所有 rocketchat 相关的 bindings */
  getRocketchatBindings(): OpenClawBinding[] {
    return (this.config.bindings || []).filter(
      (b) => b.match?.channel === "rocketchat",
    );
  }

  /** 获取所有 bindings */
  getAllBindings(): OpenClawBinding[] {
    return this.config.bindings || [];
  }

  // ----------------------------------------------------------
  // 写入 channels.rocketchat
  // ----------------------------------------------------------

  /** 设置基础配置（setup 命令调用） */
  setRocketchatChannel(serverUrl: string, port: number): void {
    if (!this.config.channels) {
      this.config.channels = {};
    }
    if (!this.config.channels.rocketchat) {
      this.config.channels.rocketchat = {};
    }

    const rc = this.config.channels.rocketchat;
    rc.enabled = true;
    rc.serverUrl = serverUrl;
    rc.port = port;

    if (!rc.dmPolicy) {
      rc.dmPolicy = "pairing";
    }
    if (!rc.accounts) {
      rc.accounts = {};
    }
    if (!rc.groups) {
      rc.groups = {};
    }
  }

  /** 添加机器人账号（add-bot 命令调用） */
  addBotAccount(
    accountId: string,
    botUsername: string,
    displayName?: string,
  ): void {
    const rc = this.ensureRocketchatConfig();
    if (!rc.accounts) {
      rc.accounts = {};
    }
    rc.accounts[accountId] = {
      botUsername,
      ...(displayName ? { botDisplayName: displayName } : {}),
    };
  }

  /** 添加 binding（add-bot 命令调用） */
  addBinding(agentId: string, accountId: string): void {
    if (!this.config.bindings) {
      this.config.bindings = [];
    }

    // 检查是否已存在
    const exists = this.config.bindings.some(
      (b) =>
        b.agentId === agentId &&
        b.match?.channel === "rocketchat" &&
        b.match?.accountId === accountId,
    );

    if (!exists) {
      this.config.bindings.push({
        agentId,
        match: { channel: "rocketchat", accountId },
      });
    }
  }

  /** 添加群组（add-group 命令调用） */
  addGroup(
    name: string,
    bots: string[],
    requireMention: boolean,
  ): void {
    const rc = this.ensureRocketchatConfig();
    if (!rc.groups) {
      rc.groups = {};
    }
    rc.groups[name] = { requireMention, bots };
  }

  /** 移除机器人账号 */
  removeBotAccount(accountId: string): void {
    const rc = this.config.channels?.rocketchat;
    if (rc?.accounts) {
      delete rc.accounts[accountId];
    }
    // 同时移除对应的 bindings
    if (this.config.bindings) {
      this.config.bindings = this.config.bindings.filter(
        (b) =>
          !(b.match?.channel === "rocketchat" && b.match?.accountId === accountId),
      );
    }
  }

  /** 移除群组 */
  removeGroup(name: string): void {
    const rc = this.config.channels?.rocketchat;
    if (rc?.groups) {
      delete rc.groups[name];
    }
  }

  /** 清除所有 rocketchat 相关配置 */
  removeRocketchatConfig(): void {
    if (this.config.channels) {
      delete this.config.channels.rocketchat;
    }
    // 移除 rocketchat 相关的 bindings
    if (this.config.bindings) {
      this.config.bindings = this.config.bindings.filter(
        (b) => b.match?.channel !== "rocketchat",
      );
    }
  }

  // ----------------------------------------------------------
  // 保存
  // ----------------------------------------------------------

  /** 保存到文件
   *  注意：写入使用标准 JSON 格式（JSON5 的子集），
   *  原始文件中的 JSON5 注释会丢失。这是已知限制。
   */
  async save(): Promise<void> {
    const content = JSON.stringify(this.config, null, 2);
    // 原子写入：先写临时文件再重命名，防止写入中断导致文件损坏
    const tmpPath = this.configPath + ".tmp";
    await writeFile(tmpPath, content + "\n", "utf-8");
    const { rename } = await import("node:fs/promises");
    await rename(tmpPath, this.configPath);
  }

  /** 保存并尝试触发热重载 */
  async saveAndReload(): Promise<void> {
    await this.save();
    // 热重载：通过向 Gateway 发送信号（如果支持的话）
    // OpenClaw 监听配置文件变化会自动重载
  }

  // ----------------------------------------------------------
  // 内部
  // ----------------------------------------------------------

  private ensureRocketchatConfig(): Partial<RocketchatChannelConfig> {
    if (!this.config.channels) {
      this.config.channels = {};
    }
    if (!this.config.channels.rocketchat) {
      this.config.channels.rocketchat = {};
    }
    return this.config.channels.rocketchat;
  }
}
