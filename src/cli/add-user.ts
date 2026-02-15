// ============================================================
// CLI: openclaw rocketchat add-user
// 添加手机登录用户 + 选择加入群组 + 设置权限
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  saveUserRecord,
} from "../config/credentials.js";
import {
  ask,
  askPassword,
  select,
  multiSelect,
  heading,
  step,
  success,
  error,
  info,
  warn,
} from "./prompts.js";

export async function addUserCommand(configPath: string): Promise<void> {
  heading("添加手机登录用户");

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

  const rc = new RocketChatRestClient(rcConfig.serverUrl);
  rc.setAuth(adminCreds.userId, adminCreds.authToken);

  // ----------------------------------------------------------
  // 2. 用户输入
  // ----------------------------------------------------------
  const username = await ask("用户名");
  if (!username) {
    error("用户名不能为空！");
    return;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    error("用户名只能包含英文字母、数字、点、下划线和连字符！");
    return;
  }

  // 检查用户是否已存在
  const existingUser = await rc.getUserInfo(username);
  if (existingUser) {
    error(`用户 ${username} 已存在！`);
    return;
  }

  const password = await askPassword("密码");
  if (!password || password.length < 6) {
    error("密码至少 6 个字符！");
    return;
  }

  const confirmPwd = await askPassword("确认密码");
  if (password !== confirmPwd) {
    error("两次密码不一致！");
    return;
  }

  // ----------------------------------------------------------
  // 3. 选择权限
  // ----------------------------------------------------------
  const permission = await select(
    "用户权限",
    [
      {
        label: "全功能 —— 可以在群里发消息、私聊机器人",
        value: "full",
      },
      {
        label: "只读 —— 只能查看群消息，不能发言也不能私聊",
        value: "readonly",
      },
    ],
  ) as "full" | "readonly";

  if (permission === "readonly") {
    info("只读用户可以查看所有群聊消息，但不能发言也不能私聊机器人。");
    info("适合旁听、审计、老板查看工作进度等场景。");
  }

  // ----------------------------------------------------------
  // 4. 选择加入的群组
  // ----------------------------------------------------------
  const groups = rcConfig.groups || {};
  const groupList = Object.keys(groups);
  let selectedGroups: string[] = [];

  if (groupList.length > 0) {
    const groupOptions = groupList.map((name) => ({
      label: `${name} (机器人: ${groups[name].bots?.join(", ") || "无"})`,
      value: name,
    }));

    selectedGroups = await multiSelect(
      "加入哪些已有群组？",
      groupOptions,
      true,
    );
  }

  // ----------------------------------------------------------
  // 5. 创建用户
  // ----------------------------------------------------------
  console.log("");
  step(`创建用户 ${username}...`);

  try {
    await rc.createUser({
      name: username,
      email: `${username}@openclaw.local`,
      password: password,
      username: username,
      roles: ["user"],
      joinDefaultChannels: false,
      verified: true,
      requirePasswordChange: false,
    });
    await saveUserRecord(username, permission);
    success(`用户 ${username} 已创建（${permission === "readonly" ? "只读" : "全功能"}）`);
  } catch (err) {
    error(`用户创建失败: ${(err as Error).message}`);
    return;
  }

  // 获取创建后的用户 ID（后续需要用到）
  const createdUser = await rc.getUserInfo(username);
  if (!createdUser) {
    error("用户创建后无法获取用户信息！");
    return;
  }

  // ----------------------------------------------------------
  // 6. 加入群组
  // ----------------------------------------------------------
  for (const groupName of selectedGroups) {
    step(`将 ${username} 加入「${groupName}」...`);
    try {
      const groupInfo = await rc.getGroupInfo(undefined, groupName);
      if (groupInfo) {
        await rc.groupInvite(groupInfo._id, createdUser._id);
        success(`已加入「${groupName}」`);

        // 只读用户：在群组中禁言
        if (permission === "readonly") {
          try {
            await rc.muteUserInRoom(groupInfo._id, createdUser._id);
            info(`  已在「${groupName}」中设为只读`);
          } catch (muteErr) {
            warn(`  禁言设置失败: ${(muteErr as Error).message}`);
          }
        }
      }
    } catch (err) {
      error(`加入群组失败: ${(err as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // 7. 为全功能用户创建与所有机器人的 DM
  // ----------------------------------------------------------
  if (permission === "full") {
    const accounts = rcConfig.accounts || {};
    for (const [, bot] of Object.entries(accounts)) {
      try {
        await rc.createDirectMessage([username, bot.botUsername]);
      } catch {
        // DM 创建失败不影响主流程
      }
    }
  } else {
    info("只读用户不创建机器人私聊通道");
  }

  // ----------------------------------------------------------
  // 8. 完成提示
  // ----------------------------------------------------------
  const hostIp = rcConfig.serverUrl || "";

  console.log("");
  success(`用户 ${username} 已创建`);
  info(`  权限: ${permission === "readonly" ? "🔒 只读" : "✅ 全功能"}`);
  if (selectedGroups.length > 0) {
    info(`  已加入: ${selectedGroups.join(", ")}`);
  }
  info(`  登录: ${hostIp} / 用户名: ${username}`);
  console.log("");
  info(`📱 告诉 ${username} 下载 Rocket.Chat App，服务器填 ${hostIp}`);
  info(`   用上面的用户名密码登录后，即可：`);
  if (permission === "readonly") {
    if (selectedGroups.length > 0) {
      info(`   - 在「${selectedGroups.join("」「")}」里查看 AI 对话记录`);
    }
    info(`   - （只读模式，无法发送消息）`);
  } else {
    if (selectedGroups.length > 0) {
      info(`   - 在「${selectedGroups.join("」「")}」里和团队一起跟 AI 讨论`);
    }
    info(`   - 直接私聊任意机器人，进行一对一 AI 对话`);
  }
  console.log("");
}
