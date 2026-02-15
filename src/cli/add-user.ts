// ============================================================
// CLI: openclaw rocketchat add-user
// 添加手机登录用户 + 选择加入群组 + 设置权限
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  saveUserRecord,
  backupUserToRcDir,
  restoreUserFromRcDir,
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

  // 检查用户是否已存在（支持插件重装后恢复）
  const existingUser = await rc.getUserInfo(username);

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

  // 如果用户已存在（插件重装后常见），尝试恢复
  if (existingUser) {
    warn(`用户 ${username} 在 Rocket.Chat 中已存在。`);

    // 尝试从备份恢复
    const backup = await restoreUserFromRcDir(username);
    if (backup) {
      info("从安装备份中找到该用户的密码，验证中...");
      try {
        await rc.login(username, backup.password);
        info("备份密码验证成功。");
      } catch {
        warn("备份密码已失效，将使用管理员权限重置密码。");
        try {
          await rc.updateUserPassword(existingUser._id, password);
          info("密码已重置为你刚才输入的密码。");
        } catch (resetErr) {
          error(`密码重置失败: ${(resetErr as Error).message}`);
          return;
        }
      }
    } else {
      // 没有备份，用管理员权限重置密码
      info("未找到备份，使用管理员权限重置密码...");
      try {
        await rc.updateUserPassword(existingUser._id, password);
        info("密码已重置为你刚才输入的密码。");
      } catch (resetErr) {
        error(`密码重置失败: ${(resetErr as Error).message}`);
        return;
      }
    }
    await saveUserRecord(username, "full"); // 默认先存 full，后面会根据选择覆盖
    await backupUserToRcDir(username, password);
    success(`已恢复用户 ${username}`);
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
  // 5. 创建用户（如果尚不存在）
  // ----------------------------------------------------------
  let createdUser = existingUser;

  if (!existingUser) {
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
      success(`用户 ${username} 已创建（${permission === "readonly" ? "只读" : "全功能"}）`);
    } catch (err) {
      error(`用户创建失败: ${(err as Error).message}`);
      return;
    }

    createdUser = await rc.getUserInfo(username);
    if (!createdUser) {
      error("用户创建后无法获取用户信息！");
      return;
    }
  }

  // 保存用户记录和备份（含权限）
  await saveUserRecord(username, permission);
  await backupUserToRcDir(username, password);

  // ----------------------------------------------------------
  // 6. 加入群组
  // ----------------------------------------------------------
  if (!createdUser) {
    error("无法获取用户信息！");
    return;
  }

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
    info(`   - （只读模式，在群内无法发送消息）`);
    info("");
    info("   💡 注意：只读通过群内禁言实现。用户仍可在 App 中搜索机器人发起私聊。");
    info("      对于家庭/团队自建场景，这通常不是问题。");
  } else {
    if (selectedGroups.length > 0) {
      info(`   - 在「${selectedGroups.join("」「")}」里和团队一起跟 AI 讨论`);
    }
    info(`   - 直接私聊任意机器人，进行一对一 AI 对话`);
  }
  console.log("");
}
