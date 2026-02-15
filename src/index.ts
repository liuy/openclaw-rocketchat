// ============================================================
// openclaw-rocketchat 插件入口
// 注册频道、CLI 命令、后台服务
// ============================================================

import { resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { ChannelService } from "./service/channel.js";
import { setupCommand } from "./cli/setup.js";
import { addBotCommand } from "./cli/add-bot.js";
import { addGroupCommand } from "./cli/add-group.js";
import { addUserCommand } from "./cli/add-user.js";
import { removeUserCommand } from "./cli/remove-user.js";
import { inviteCommand } from "./cli/invite.js";
import { statusCommand } from "./cli/status.js";
import { uninstallCommand } from "./cli/uninstall.js";

/** OpenClaw 配置文件路径的缓存 */
let configFilePath = "";

/** 频道服务实例 */
let channelService: ChannelService | null = null;

/**
 * OpenClaw Plugin Runtime（由 api.runtime 提供）
 * 包含消息分发、配置加载等核心 API
 * 参考官方 Feishu 插件的做法：在 register() 时保存，后续使用
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pluginRuntime: any = null;

/**
 * 获取 openclaw.json 路径
 * 优先级：缓存 → ~/.openclaw/openclaw.json → cwd/openclaw.json
 */
function getConfigPath(): string {
  if (configFilePath) return configFilePath;

  // OpenClaw 2026+ 标准路径：~/.openclaw/openclaw.json
  const homeConfig = resolve(homedir(), ".openclaw", "openclaw.json");
  if (existsSync(homeConfig)) {
    configFilePath = homeConfig;
    return homeConfig;
  }

  // 兜底：当前工作目录
  return resolve(process.cwd(), "openclaw.json");
}

/**
 * 出站消息辅助函数
 * 解析 target（可能是 roomId、accountId:roomId 等格式），发送到 RC
 */
async function sendOutbound(
  text: string,
  accountId: string | null | undefined,
  to: string,
  logger: { info: (msg: string) => void; error: (msg: string) => void },
): Promise<{ ok: boolean }> {
  if (!channelService) {
    logger.error("频道服务未启动，无法发送出站消息");
    return { ok: false };
  }
  const handler = channelService.getMessageHandler();
  if (!handler) {
    logger.error("消息处理器未初始化");
    return { ok: false };
  }

  // 解析 target → (botUsername, roomId)
  let botUsername = accountId || "";
  let roomId = to || "";

  // 格式 1: "accountId:roomId" → 拆分
  if (!botUsername && roomId.includes(":")) {
    const colonIdx = roomId.indexOf(":");
    const prefix = roomId.slice(0, colonIdx);
    const suffix = roomId.slice(colonIdx + 1);
    // 如果后缀是 hex id，则前缀是 accountId
    if (/^[a-f0-9]{17,24}$/i.test(suffix)) {
      botUsername = prefix;
      roomId = suffix;
    }
  }

  // 格式 2: "rocketchat:dm:botUsername" 或 "rocketchat:group:roomId" → 提取
  if (roomId.startsWith("rocketchat:")) {
    const parts = roomId.split(":");
    if (parts[1] === "dm" && parts[2]) {
      // rocketchat:dm:botUsername → 需要查找对应的 DM roomId
      // 这种情况下 botUsername 可能是 parts[2]
      if (!botUsername) botUsername = parts[2];
    } else if (parts[1] === "group" && parts[2]) {
      roomId = parts[2];
    }
  }

  // 如果没有 botUsername，使用第一个可用的机器人
  if (!botUsername) {
    const botManager = channelService.getBotManager();
    const bots = botManager?.getConnectedBots?.() || [];
    if (bots.length > 0) {
      botUsername = bots[0];
    }
  }

  if (!botUsername || !roomId) {
    logger.error(`出站消息缺少 accountId(${botUsername}) 或 target(${roomId})`);
    return { ok: false };
  }

  if (!text.trim()) {
    return { ok: true }; // 空消息不需要发送
  }

  try {
    await handler.handleOutbound(text, botUsername, roomId);
    return { ok: true };
  } catch (err) {
    logger.error(`出站发送失败: ${(err as Error).message}`);
    return { ok: false };
  }
}

/**
 * 插件入口：注册到 OpenClaw
 */
export default function register(api: any): void {
  const logger = api.logger || {
    info: (msg: string) => console.log(`[RC] ${msg}`),
    error: (msg: string) => console.error(`[RC] ${msg}`),
  };

  // 保存 Plugin Runtime（核心 API，包含消息分发等）
  pluginRuntime = api.runtime || null;

  logger.info("Rocket.Chat 插件已加载");

  // ----------------------------------------------------------
  // 1. 注册频道
  // ----------------------------------------------------------
  api.registerChannel({
    plugin: {
      id: "rocketchat",
      meta: {
        id: "rocketchat",
        label: "Rocket.Chat",
        selectionLabel: "Rocket.Chat (自托管)",
        docsPath: "/channels/rocketchat",
        blurb:
          "通过 Rocket.Chat App 与 OpenClaw 对话。自托管、数据自控，适合中国大陆用户。",
        aliases: ["rc", "rocket"],
      },
      capabilities: {
        chatTypes: ["direct", "group"],
      },
      config: {
        /**
         * 列出所有 account IDs（机器人用户名）
         */
        listAccountIds: (cfg: any): string[] => {
          const accounts = cfg?.accounts || {};
          return Object.keys(accounts);
        },
        /**
         * 解析 account 配置
         */
        resolveAccount: (cfg: any, accountId?: string): any => {
          if (!accountId) {
            const ids = Object.keys(cfg?.accounts || {});
            accountId = ids[0];
          }
          return cfg?.accounts?.[accountId] || null;
        },
      },
      messaging: {
        targetResolver: {
          hint: "Use a Rocket.Chat room ID (24-char hex), or prefix with # for channels, @ for users.",
          /**
           * Rocket.Chat 的 target 是 MongoDB ObjectId（24 位十六进制字符串）
           * 默认的 looksLikeTargetId 无法识别这种格式，导致 "Unknown target" 错误
           */
          looksLikeId: (raw: string, _normalized: string): boolean => {
            const trimmed = raw.trim();
            // MongoDB ObjectId: 17-24 char hex string
            if (/^[a-f0-9]{17,24}$/i.test(trimmed)) {
              return true;
            }
            // Prefixed forms: channel:xxx, group:xxx, user:xxx
            if (/^(channel|group|user):/i.test(trimmed)) {
              return true;
            }
            // @username or #channel
            if (/^[@#]/.test(trimmed)) {
              return true;
            }
            // accountId:roomId 格式（Agent 主动发送时可能使用此格式）
            if (/^[^:]+:[a-f0-9]{17,24}$/i.test(trimmed)) {
              return true;
            }
            // rocketchat:dm:xxx 或 rocketchat:group:xxx 等完整路径
            if (/^rocketchat:/i.test(trimmed)) {
              return true;
            }
            return false;
          },
        },
      },
      outbound: {
        deliveryMode: "direct" as const,
        textChunkLimit: 4000,
        /**
         * Agent → 发送文本到 Rocket.Chat
         * 接口遵循 ChannelOutboundContext
         */
        sendText: async (ctx: {
          cfg: any;
          to: string;
          text: string;
          accountId?: string | null;
          replyToId?: string | null;
          threadId?: string | number | null;
          silent?: boolean;
        }): Promise<{ channel: string; ok: boolean }> => {
          const result = await sendOutbound(ctx.text, ctx.accountId, ctx.to, logger);
          return { channel: "rocketchat", ...result };
        },
        /**
         * Agent → 发送媒体到 Rocket.Chat（降级为文本链接）
         */
        sendMedia: async (ctx: {
          cfg: any;
          to: string;
          text: string;
          mediaUrl?: string;
          accountId?: string | null;
          replyToId?: string | null;
          threadId?: string | number | null;
          silent?: boolean;
        }): Promise<{ channel: string; ok: boolean }> => {
          // 如果有媒体 URL，以文本链接形式发送
          let text = ctx.text || "";
          if (ctx.mediaUrl) {
            text = text ? `${text}\n📎 ${ctx.mediaUrl}` : `📎 ${ctx.mediaUrl}`;
          }
          const result = await sendOutbound(text, ctx.accountId, ctx.to, logger);
          return { channel: "rocketchat", ...result };
        },
      },
    },
  });

  // ----------------------------------------------------------
  // 2. 注册 CLI 命令
  // ----------------------------------------------------------
  api.registerCli(
    ({ program }: { program: any }) => {
      const rc = program
        .command("rocketchat")
        .alias("rc")
        .description("Rocket.Chat 频道管理");

      rc.command("setup")
        .description(
          "连接 Rocket.Chat 服务器 + 创建管理员 + 创建手机登录账号",
        )
        .action(async () => {
          await setupCommand(getConfigPath());
        });

      rc.command("add-bot")
        .description("添加机器人（自动绑定 Agent + 建立 DM 私聊）")
        .action(async () => {
          await addBotCommand(getConfigPath());
        });

      rc.command("add-group")
        .description("创建私有频道（多机器人群组）")
        .action(async () => {
          await addGroupCommand(getConfigPath());
        });

      rc.command("add-user")
        .description("添加手机登录用户")
        .action(async () => {
          await addUserCommand(getConfigPath());
        });

      rc.command("remove-user")
        .description("删除手机登录用户")
        .action(async () => {
          await removeUserCommand(getConfigPath());
        });

      rc.command("invite")
        .description("群组成员管理（邀请/移除/设管理员/设所有者）")
        .action(async () => {
          await inviteCommand(getConfigPath());
        });

      rc.command("status")
        .description("查看 Rocket.Chat 运行状态")
        .action(async () => {
          await statusCommand(getConfigPath());
        });

      rc.command("uninstall")
        .description("卸载 Rocket.Chat（停止容器、清理配置）")
        .action(async () => {
          await uninstallCommand(getConfigPath());
        });
    },
    {
      commands: [
        "rocketchat",
        "rocketchat setup",
        "rocketchat add-bot",
        "rocketchat add-group",
        "rocketchat add-user",
        "rocketchat remove-user",
        "rocketchat invite",
        "rocketchat status",
        "rocketchat uninstall",
      ],
    },
  );

  // ----------------------------------------------------------
  // 3. 注册后台服务
  // ----------------------------------------------------------
  api.registerService({
    id: "rocketchat-channel",
    start: async () => {
      // 直接从配置文件读取 channels.rocketchat，不依赖 api.pluginConfig
      // （OpenClaw 框架可能因 plugin id 不匹配而无法正确传递 pluginConfig）
      const { ConfigWriter } = await import("./config/writer.js");
      const cw = new ConfigWriter(getConfigPath());
      await cw.readConfig();
      const rcConfig = cw.getRocketchatConfig();

      if (!rcConfig?.enabled) {
        logger.info("Rocket.Chat 未启用，后台服务不启动");
        return;
      }

      const bindings = cw.getRocketchatBindings();

      channelService = new ChannelService({
        config: rcConfig,
        bindings,
        logger,
        runtime: pluginRuntime,
      });

      try {
        await channelService.start();
      } catch (err) {
        logger.error(
          `后台服务启动失败: ${(err as Error).message}`,
        );
      }
    },
    stop: () => {
      channelService?.stop();
      channelService = null;
    },
  });

  logger.info("Rocket.Chat 插件注册完成");
}
