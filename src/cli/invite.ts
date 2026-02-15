// ============================================================
// CLI: openclaw rocketchat invite
// 群组成员管理（邀请/移除/设管理员/设所有者）
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  loadUserRecords,
} from "../config/credentials.js";
import {
  select,
  multiSelect,
  heading,
  step,
  success,
  error,
  info,
} from "./prompts.js";

export async function inviteCommand(configPath: string): Promise<void> {
  heading("群组成员管理");

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

  const groups = rcConfig.groups || {};
  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    error("没有找到任何群组！");
    info("请先创建群组: openclaw rocketchat add-group");
    return;
  }

  const rc = new RocketChatRestClient(rcConfig.serverUrl);
  rc.setAuth(adminCreds.userId, adminCreds.authToken);

  // ----------------------------------------------------------
  // 2. 选择群组
  // ----------------------------------------------------------
  const groupOptions = groupNames.map((name) => ({
    label: name,
    value: name,
  }));

  const selectedGroup = await select("选择群组", groupOptions);

  // ----------------------------------------------------------
  // 3. 显示当前成员
  // ----------------------------------------------------------
  const groupInfo = await rc.getGroupInfo(undefined, selectedGroup);
  if (!groupInfo) {
    error(`群组「${selectedGroup}」不存在！`);
    return;
  }

  const members = await rc.getGroupMembers(groupInfo._id);
  console.log(`\n${selectedGroup} 当前成员:`);
  for (const member of members) {
    const roles = member.roles?.length
      ? ` (${member.roles.join(", ")})`
      : "";
    console.log(`  ${member.username}${roles}`);
  }

  // ----------------------------------------------------------
  // 4. 选择操作
  // ----------------------------------------------------------
  const action = await select("操作", [
    { label: "邀请用户进群", value: "invite" },
    { label: "移除用户", value: "kick" },
    { label: "设为管理员 (Moderator)", value: "moderator" },
    { label: "设为所有者 (Owner)", value: "owner" },
    { label: "返回", value: "back" },
  ]);

  if (action === "back") return;

  const memberUsernames = members.map((m) => m.username);

  if (action === "invite") {
    // 邀请：显示不在群内的用户
    const allUsers = await loadUserRecords();
    const notInGroup = allUsers.filter(
      (u) => !memberUsernames.includes(u.username),
    );

    if (notInGroup.length === 0) {
      info("所有用户都已在群内！");
      info("添加新用户: openclaw rocketchat add-user");
      return;
    }

    const options = notInGroup.map((u) => ({
      label: u.username,
      value: u.username,
    }));

    const toInvite = await multiSelect("邀请谁？", options);

    // 加载用户记录以检查权限
    const userRecords = await loadUserRecords();

    for (const username of toInvite) {
      step(`邀请 ${username}...`);
      try {
        const userInfo = await rc.getUserInfo(username);
        if (!userInfo) {
          error(`用户 ${username} 在 Rocket.Chat 中不存在`);
          continue;
        }
        await rc.groupInvite(groupInfo._id, userInfo._id);
        success(`${username} 已加入「${selectedGroup}」`);

        // 只读用户自动禁言
        const record = userRecords.find((u) => u.username === username);
        if (record?.permission === "readonly") {
          try {
            await rc.muteUserInRoom(groupInfo._id, userInfo._id);
            info(`  已在「${selectedGroup}」中设为只读`);
          } catch {
            // 禁言失败不影响主流程
          }
        }
      } catch (err) {
        error(`邀请失败: ${(err as Error).message}`);
      }
    }
  } else if (action === "kick") {
    const options = members
      .filter((m) => !m.roles?.includes("owner"))
      .map((m) => ({
        label: `${m.username}${m.roles?.length ? ` (${m.roles.join(", ")})` : ""}`,
        value: m.username,
      }));

    if (options.length === 0) {
      info("没有可移除的成员（Owner 不能移除）！");
      return;
    }

    const toKick = await multiSelect("移除谁？", options);

    for (const username of toKick) {
      step(`移除 ${username}...`);
      try {
        const member = members.find((m) => m.username === username);
        if (member) {
          await rc.groupKick(groupInfo._id, member._id);
          success(`${username} 已从「${selectedGroup}」移除`);
        }
      } catch (err) {
        error(`移除失败: ${(err as Error).message}`);
      }
    }
  } else if (action === "moderator") {
    const options = members
      .filter((m) => !m.roles?.includes("moderator") && !m.roles?.includes("owner"))
      .map((m) => ({
        label: m.username,
        value: m.username,
      }));

    if (options.length === 0) {
      info("没有可设为管理员的成员！");
      return;
    }

    const toMod = await multiSelect("设谁为管理员？", options);

    for (const username of toMod) {
      step(`设置 ${username} 为管理员...`);
      try {
        const member = members.find((m) => m.username === username);
        if (member) {
          await rc.groupAddModerator(groupInfo._id, member._id);
          success(`${username} 已成为「${selectedGroup}」管理员`);
        }
      } catch (err) {
        error(`设置失败: ${(err as Error).message}`);
      }
    }
  } else if (action === "owner") {
    const options = members
      .filter((m) => !m.roles?.includes("owner"))
      .map((m) => ({
        label: m.username,
        value: m.username,
      }));

    if (options.length === 0) {
      info("没有可设为所有者的成员！");
      return;
    }

    const toOwn = await multiSelect("设谁为所有者？", options);

    for (const username of toOwn) {
      step(`设置 ${username} 为所有者...`);
      try {
        const member = members.find((m) => m.username === username);
        if (member) {
          await rc.groupAddOwner(groupInfo._id, member._id);
          success(`${username} 已成为「${selectedGroup}」所有者`);
        }
      } catch (err) {
        error(`设置失败: ${(err as Error).message}`);
      }
    }
  }
}
