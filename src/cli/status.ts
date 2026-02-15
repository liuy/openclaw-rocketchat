// ============================================================
// CLI: openclaw rocketchat status
// 显示 Rocket.Chat 运行状态
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  loadUserRecords,
} from "../config/credentials.js";
import { heading, info, warn, error } from "./prompts.js";

export async function statusCommand(configPath: string): Promise<void> {
  heading("Rocket.Chat 状态");

  // ----------------------------------------------------------
  // 1. 加载配置
  // ----------------------------------------------------------
  const configWriter = new ConfigWriter(configPath);
  await configWriter.readConfig();
  const rcConfig = configWriter.getRocketchatConfig();

  if (!rcConfig?.serverUrl) {
    error("未找到 Rocket.Chat 配置！请先运行: openclaw rocketchat setup");
    return;
  }

  const serverUrl = rcConfig.serverUrl;
  const port = rcConfig.port || 3000;

  // ----------------------------------------------------------
  // 2. 通过 REST API 检测服务器状态
  // ----------------------------------------------------------
  const adminCreds = await loadAdminCredentials();
  let rc: RocketChatRestClient | null = null;
  let serverOnline = false;
  let rcVersion = "未知";

  if (adminCreds) {
    rc = new RocketChatRestClient(serverUrl);
    rc.setAuth(adminCreds.userId, adminCreds.authToken);

    try {
      rcVersion = await rc.getServerVersion();
      serverOnline = true;
    } catch {
      // 服务器不可达
    }
  }

  if (serverOnline) {
    info(`服务器:     运行中 - ${serverUrl} (v${rcVersion})`);
  } else {
    warn(`服务器:     无法连接 - ${serverUrl}`);
    info("  请检查 Rocket.Chat 是否已启动：");
    info("    docker ps  或  cd ~/rocketchat && docker compose ps");
    console.log("");
    return;
  }

  // ----------------------------------------------------------
  // 3. 用户列表
  // ----------------------------------------------------------
  console.log("");
  const users = await loadUserRecords();
  if (users.length > 0) {
    info(`用户`);
    for (const u of users) {
      const permLabel = u.permission === "readonly" ? " 🔒只读" : "";
      info(`  ${u.username}${permLabel}`);
    }
  }

  // ----------------------------------------------------------
  // 4. 机器人状态
  // ----------------------------------------------------------
  console.log("");
  const accounts = rcConfig?.accounts || {};
  const bindings = configWriter.getRocketchatBindings();

  const botEntries = Object.entries(accounts);
  const agentsList = await configWriter.getAgentsList();

  if (botEntries.length > 0) {
    info("机器人                        Agent           状态");

    let hasAgentWarning = false;
    for (const [accountId, bot] of botEntries) {
      const binding = bindings.find(
        (b) => b.match?.accountId === accountId,
      );
      const agentId = binding?.agentId || "未绑定";

      // 检查 Agent 是否存在
      const agentExists =
        agentId === "未绑定" || agentsList.some((a) => a.id === agentId);

      let status = "未知";
      if (rc) {
        try {
          const userInfo = await rc.getUserInfo(bot.botUsername);
          status = userInfo?.status === "online" ? "在线" : "离线";
        } catch {
          status = "检测失败";
        }
      }

      if (!agentExists) {
        status += " ⚠️ Agent 不存在";
        hasAgentWarning = true;
      }

      const displayName = bot.botDisplayName
        ? `${bot.botUsername} (${bot.botDisplayName})`
        : bot.botUsername;
      info(
        `  ${displayName.padEnd(28)} ${agentId.padEnd(16)} ${status}`,
      );
    }

    if (hasAgentWarning) {
      console.log("");
      warn("⚠️  部分机器人绑定的 Agent 已不存在！消息路由将失败。");
      info("   修复方式: openclaw agents add <名称> 重新创建 Agent");
      info("   或 openclaw rocketchat add-bot 重新绑定到其他 Agent");
    }
  }

  // ----------------------------------------------------------
  // 5. DM 列表
  // ----------------------------------------------------------
  if (users.length > 0 && botEntries.length > 0) {
    console.log("");
    info("DM 私聊");
    for (const user of users) {
      if (user.permission === "readonly") continue;
      for (const [, bot] of botEntries) {
        info(`  ${user.username} <-> ${bot.botUsername}`);
      }
    }
  }

  // ----------------------------------------------------------
  // 6. 群组列表
  // ----------------------------------------------------------
  const groups = rcConfig?.groups || {};
  const groupEntries = Object.entries(groups);
  if (groupEntries.length > 0) {
    console.log("");
    info("私有频道");

    for (const [groupName, groupConfig] of groupEntries) {
      let memberInfo = "";
      if (rc) {
        try {
          const groupData = await rc.getGroupInfo(undefined, groupName);
          if (groupData) {
            const members = await rc.getGroupMembers(groupData._id);
            memberInfo = members
              .map((m) => {
                const role = m.roles?.includes("owner")
                  ? "(Owner)"
                  : m.roles?.includes("bot")
                    ? "(Bot)"
                    : "";
                return `${m.username}${role}`;
              })
              .join(", ");
          }
        } catch {
          memberInfo = groupConfig.bots?.join(", ") || "";
        }
      } else {
        memberInfo = groupConfig.bots?.join(", ") || "";
      }
      info(`  ${groupName}     ${memberInfo}`);
    }
  }

  console.log("");
}
