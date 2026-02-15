// ============================================================
// CLI: openclaw rocketchat add-bot
// 创建 RC 机器人 + 读取已有 Agent 列表绑定 + 自动建立 DM + 写入配置
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  saveBotCredentials,
  generatePassword,
  loadUserRecords,
  restoreBotFromRcDir,
} from "../config/credentials.js";
import {
  ask,
  select,
  heading,
  step,
  success,
  error,
  warn,
  info,
} from "./prompts.js";

export async function addBotCommand(configPath: string): Promise<void> {
  heading("添加 Rocket.Chat 机器人");

  // ----------------------------------------------------------
  // 1. 加载凭据和配置
  // ----------------------------------------------------------
  const adminCreds = await loadAdminCredentials();
  if (!adminCreds) {
    error("未找到管理员凭据！请先运行: openclaw rocketchat setup");
    return;
  }

  const configWriter = new ConfigWriter(configPath);
  await configWriter.readConfig();

  const rcConfig = configWriter.getRocketchatConfig();
  if (!rcConfig?.serverUrl) {
    error("未找到 Rocket.Chat 配置！请先运行: openclaw rocketchat setup");
    return;
  }

  // 连接 RC
  const rc = new RocketChatRestClient(rcConfig.serverUrl);
  rc.setAuth(adminCreds.userId, adminCreds.authToken);

  // ----------------------------------------------------------
  // 2. 读取 Agent 列表
  // ----------------------------------------------------------
  const agents = await configWriter.getAgentsList();
  if (agents.length === 0) {
    error("没有找到任何 Agent！");
    info("请先创建 Agent: openclaw agents add <名称>");
    info("");
    info("Agent 是 OpenClaw 中的 AI 大脑，不同 Agent 有不同的人设和能力。");
    info("每个机器人需要绑定到一个 Agent 才能工作。");
    return;
  }

  // ----------------------------------------------------------
  // 3. 用户输入
  // ----------------------------------------------------------
  const botUsername = await ask(
    "机器人用户名\n  （机器人在聊天中显示的 ID，建议用英文，如 molty、my-bot）",
  );

  if (!botUsername) {
    error("用户名不能为空！");
    return;
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(botUsername)) {
    error("用户名只能包含英文字母、数字、点、下划线和连字符！");
    return;
  }

  // 检查是否已存在
  const existing = rcConfig.accounts?.[botUsername];
  if (existing) {
    warn(`机器人 ${botUsername} 已经存在！`);
    return;
  }

  const displayName = await ask(
    "显示昵称\n  （机器人在聊天中显示的名字，可以用中文，如 小龙虾、工作助手）",
    botUsername,
  );

  // 选择 Agent
  const agentOptions = agents.map((a) => ({
    label: `${a.id}${a.default ? " (默认)" : ""}${a.name ? ` - ${a.name}` : ""}`,
    value: a.id,
  }));

  info("");
  info("绑定到哪个 Agent？");
  info("（Agent 是 OpenClaw 中的 AI 大脑，不同 Agent 有不同的人设和能力。");
  info("  如果你还没有创建，先退出，运行: openclaw agents add <名称>）");

  const agentId = await select("当前 Agent", agentOptions);

  // ----------------------------------------------------------
  // 4. 创建机器人
  // ----------------------------------------------------------
  console.log("");
  step(`创建机器人用户 ${botUsername}...`);

  const botPassword = generatePassword();
  try {
    const botUser = await rc.createUser({
      name: displayName,
      email: `${botUsername}@openclaw.local`,
      password: botPassword,
      username: botUsername,
      roles: ["bot"],
      joinDefaultChannels: false,
      verified: true,
      requirePasswordChange: false,
    });

    await saveBotCredentials(botUsername, botUser._id, botPassword);
    success(`机器人用户 ${botUsername} 已创建`);
  } catch (err) {
    const msg = (err as Error).message || "";

    // 用户名已被占用 — 尝试从备份恢复
    if (msg.includes("already in use") || msg.includes("already exists") || msg.includes("Username is already")) {
      warn(`机器人 ${botUsername} 在 Rocket.Chat 中已存在，尝试恢复凭据...`);

      // 尝试从 RC 安装目录备份恢复
      const backup = await restoreBotFromRcDir(botUsername);
      if (backup) {
        info("从安装备份中找到凭据，验证中...");
        try {
          const loginResult = await rc.login(botUsername, backup.password);
          await saveBotCredentials(botUsername, loginResult.userId, backup.password);
          success(`已恢复机器人 ${botUsername} 的凭据`);
        } catch {
          // 备份密码失效，用管理员权限重置
          warn("备份密码已失效，使用管理员权限重置...");
          try {
            const botInfo = await rc.getUserInfo(botUsername);
            if (botInfo) {
              await rc.updateUserPassword(botInfo._id, botPassword);
              await saveBotCredentials(botUsername, botInfo._id, botPassword);
              success(`已重置机器人 ${botUsername} 的密码`);
            } else {
              error(`无法找到机器人 ${botUsername} 的信息`);
              return;
            }
          } catch (resetErr) {
            error(`密码重置失败: ${(resetErr as Error).message}`);
            return;
          }
        }
      } else {
        // 没有备份，直接用管理员权限重置密码
        info("未找到备份凭据，使用管理员权限重置密码...");
        try {
          const botInfo = await rc.getUserInfo(botUsername);
          if (botInfo) {
            await rc.updateUserPassword(botInfo._id, botPassword);
            await saveBotCredentials(botUsername, botInfo._id, botPassword);
            success(`已重置机器人 ${botUsername} 的密码并恢复凭据`);
          } else {
            error(`无法找到机器人 ${botUsername} 的信息`);
            return;
          }
        } catch (resetErr) {
          error(`密码重置失败: ${(resetErr as Error).message}`);
          return;
        }
      }
    } else {
      error(`机器人创建失败: ${msg}`);
      return;
    }
  }

  // ----------------------------------------------------------
  // 5. 为所有已有用户建立 DM 私聊
  // ----------------------------------------------------------
  const users = await loadUserRecords();
  if (users.length > 0) {
    for (const user of users) {
      // 只读用户不创建 DM
      if (user.permission === "readonly") {
        info(`${user.username} 是只读用户，跳过 DM 创建`);
        continue;
      }
      step(`建立 ${user.username} 与 ${botUsername} 的私聊通道...`);
      try {
        await rc.createDirectMessage([user.username, botUsername]);
        success(`${user.username} <-> ${botUsername} DM 已就绪`);
      } catch (err) {
        warn(`${user.username} DM 创建失败: ${(err as Error).message}`);
      }
    }
  }

  // ----------------------------------------------------------
  // 6. 写入配置
  // ----------------------------------------------------------
  step("写入配置 + 绑定...");
  configWriter.addBotAccount(botUsername, botUsername, displayName);
  configWriter.addBinding(agentId, botUsername);
  await configWriter.saveAndReload();
  success("配置已更新");

  // ----------------------------------------------------------
  // 7. 完成提示
  // ----------------------------------------------------------
  console.log("");
  success(`机器人 ${botUsername} (${displayName}) 已创建`);
  info(`  绑定到 Agent: ${agentId}`);
  info("  DM 私聊已就绪");
  console.log("");
  info("📱 打开 Rocket.Chat App 和机器人聊天：");
  info(`   如果会话列表中没有看到 ${displayName}，点左上角「搜索」图标，`);
  info(`   输入「${botUsername}」即可找到并开始私聊。`);
  console.log("");
  info("💡 更多操作:");
  info("   创建多机器人群组: openclaw rocketchat add-group");
  info("   创建新 Agent:    openclaw agents add <name>");
  console.log("");
}
