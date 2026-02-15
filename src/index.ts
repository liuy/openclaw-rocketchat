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
 * 插件入口：注册到 OpenClaw
 */
export default function register(api: any): void {
  const logger = api.logger || {
    info: (msg: string) => console.log(`[RC] ${msg}`),
    error: (msg: string) => console.error(`[RC] ${msg}`),
  };

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
      outbound: {
        deliveryMode: "direct" as const,
        /**
         * Agent 回复 → 发送到 Rocket.Chat
         */
        sendText: async (params: {
          text: string;
          accountId?: string;
          target?: string;
        }): Promise<{ ok: boolean }> => {
          if (!channelService) {
            logger.error("频道服务未启动");
            return { ok: false };
          }

          const handler = channelService.getMessageHandler();
          if (!handler) {
            logger.error("消息处理器未初始化");
            return { ok: false };
          }

          const botUsername = params.accountId || "";
          const roomId = params.target || "";

          if (!botUsername || !roomId) {
            logger.error("缺少 accountId 或 target");
            return { ok: false };
          }

          try {
            await handler.handleOutbound(params.text, botUsername, roomId);
            return { ok: true };
          } catch (err) {
            logger.error(
              `发送失败: ${(err as Error).message}`,
            );
            return { ok: false };
          }
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
