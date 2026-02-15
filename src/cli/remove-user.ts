// ============================================================
// CLI: openclaw rocketchat remove-user
// 删除手机登录用户（从 RC 服务器移除 + 清理本地记录）
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  loadUserRecords,
  removeUserRecord,
} from "../config/credentials.js";
import {
  select,
  confirm,
  heading,
  step,
  success,
  error,
  info,
  warn,
} from "./prompts.js";

export async function removeUserCommand(configPath: string): Promise<void> {
  heading("删除手机登录用户");

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
  // 2. 列出可删除的用户
  // ----------------------------------------------------------
  const users = await loadUserRecords();
  if (users.length === 0) {
    info("当前没有已添加的用户。");
    return;
  }

  const options = users.map((u) => ({
    label: u.username,
    value: u.username,
  }));

  const username = await select("选择要删除的用户", options);

  // ----------------------------------------------------------
  // 3. 确认操作
  // ----------------------------------------------------------
  warn(`⚠️  即将删除用户 ${username}，此操作不可恢复！`);
  info(`   该用户将从 Rocket.Chat 服务器上永久删除，`);
  info(`   同时从所有群组中移除，DM 记录也将丢失。`);
  console.log("");

  const confirmed = await confirm(`确认删除 ${username}？`);
  if (!confirmed) {
    info("已取消。");
    return;
  }

  console.log("");

  // ----------------------------------------------------------
  // 4. 从 RC 群组中移除
  // ----------------------------------------------------------
  const groups = rcConfig.groups || {};
  for (const groupName of Object.keys(groups)) {
    try {
      const groupInfo = await rc.getGroupInfo(undefined, groupName);
      if (groupInfo) {
        const members = await rc.getGroupMembers(groupInfo._id);
        const member = members.find((m) => m.username === username);
        if (member) {
          step(`从「${groupName}」移除...`);
          await rc.groupKick(groupInfo._id, member._id);
          success(`已从「${groupName}」移除`);
        }
      }
    } catch (err) {
      warn(`从群组 ${groupName} 移除失败: ${(err as Error).message}`);
    }
  }

  // ----------------------------------------------------------
  // 5. 从 RC 服务器删除用户
  // ----------------------------------------------------------
  step(`从 Rocket.Chat 删除用户 ${username}...`);
  try {
    const userInfo = await rc.getUserInfo(username);
    if (userInfo) {
      await rc.deleteUser(userInfo._id);
      success(`用户 ${username} 已从 Rocket.Chat 删除`);
    } else {
      warn(`用户 ${username} 在 Rocket.Chat 中不存在（可能已被手动删除）`);
    }
  } catch (err) {
    error(`删除失败: ${(err as Error).message}`);
    info("你可以在 Rocket.Chat 管理后台手动删除该用户。");
    // 即使 RC 删除失败，也继续清理本地记录
  }

  // ----------------------------------------------------------
  // 6. 清理本地记录
  // ----------------------------------------------------------
  step("清理本地记录...");
  await removeUserRecord(username);
  success("本地记录已清理");

  // ----------------------------------------------------------
  // 7. 完成
  // ----------------------------------------------------------
  console.log("");
  success(`用户 ${username} 已完全删除`);
  info("  该用户的 Rocket.Chat App 将无法再登录。");
  console.log("");
}
