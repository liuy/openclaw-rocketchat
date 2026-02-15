// ============================================================
// CLI: openclaw rocketchat status
// 显示 Rocket.Chat 运行状态
// ============================================================

import { DockerManager } from "../docker/manager.js";
import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  loadUserRecords,
  getDockerDir,
} from "../config/credentials.js";
import { heading, info, warn, error } from "./prompts.js";

export async function statusCommand(configPath: string): Promise<void> {
  heading("Rocket.Chat 状态");

  // ----------------------------------------------------------
  // 1. Docker 状态
  // ----------------------------------------------------------
  const dockerDir = getDockerDir();
  const docker = new DockerManager(dockerDir);

  if (!docker.composeFileExists()) {
    error("未找到 Docker 配置！请先运行: openclaw rocketchat setup");
    return;
  }

  const containerStatus = await docker.getStatus();
  const hostIp = docker.getHostIp();

  const configWriter = new ConfigWriter(configPath);
  await configWriter.readConfig();
  const rcConfig = configWriter.getRocketchatConfig();
  const port = rcConfig?.port || 3000;

  const rcStatusText =
    containerStatus.rocketchat === "running"
      ? `运行中 - http://${hostIp}:${port}`
      : containerStatus.rocketchat === "stopped"
        ? "已停止"
        : "未找到";

  const mongoStatusText =
    containerStatus.mongodb === "running"
      ? "运行中"
      : containerStatus.mongodb === "stopped"
        ? "已停止"
        : "未找到";

  info(`服务器:     ${rcStatusText}`);
  if (containerStatus.uptime) {
    info(`运行时间:   ${containerStatus.uptime}`);
  }
  info(`MongoDB:    ${mongoStatusText}`);

  if (containerStatus.rocketchat !== "running") {
    console.log("");
    info('启动命令: openclaw rocketchat setup（或手动 docker compose up -d）');
    return;
  }

  // ----------------------------------------------------------
  // 2. 用户列表
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
  // 3. 初始化 RC 客户端（复用，不重复加载）
  // ----------------------------------------------------------
  const adminCreds = await loadAdminCredentials();
  let rc: RocketChatRestClient | null = null;
  if (adminCreds && rcConfig?.serverUrl) {
    rc = new RocketChatRestClient(rcConfig.serverUrl);
    rc.setAuth(adminCreds.userId, adminCreds.authToken);
  }

  // ----------------------------------------------------------
  // 4. 机器人状态
  // ----------------------------------------------------------
  console.log("");
  const accounts = rcConfig?.accounts || {};
  const bindings = configWriter.getRocketchatBindings();

  const botEntries = Object.entries(accounts);
  const agentsList = configWriter.getAgentsList();

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
