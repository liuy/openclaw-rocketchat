// ============================================================
// CLI: openclaw rocketchat add-group
// 创建私有频道 + 选择机器人和用户加入 + 设置角色 + 写入配置
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
  loadUserRecords,
} from "../config/credentials.js";
import {
  ask,
  confirm,
  multiSelect,
  heading,
  step,
  success,
  error,
  info,
} from "./prompts.js";

export async function addGroupCommand(configPath: string): Promise<void> {
  heading("创建 Rocket.Chat 私有频道");

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

  // 检查是否有机器人
  const accounts = rcConfig.accounts || {};
  const botList = Object.entries(accounts);
  if (botList.length === 0) {
    error("没有找到任何机器人！");
    info("请先添加机器人: openclaw rocketchat add-bot");
    return;
  }

  const rc = new RocketChatRestClient(rcConfig.serverUrl);
  rc.setAuth(adminCreds.userId, adminCreds.authToken);

  // ----------------------------------------------------------
  // 2. 用户输入
  // ----------------------------------------------------------
  const groupName = await ask("频道名称");
  if (!groupName) {
    error("频道名称不能为空！");
    return;
  }

  // 检查频道是否已存在
  if (rcConfig.groups?.[groupName]) {
    error(`频道「${groupName}」已存在！`);
    return;
  }

  // 选择机器人
  const bindings = configWriter.getRocketchatBindings();
  const botOptions = botList.map(([id, bot]) => {
    const binding = bindings.find((b) => b.match?.accountId === id);
    const agentInfo = binding ? ` -> Agent: ${binding.agentId}` : "";
    return {
      label: `${bot.botUsername}${bot.botDisplayName ? ` (${bot.botDisplayName})` : ""}${agentInfo}`,
      value: bot.botUsername,
    };
  });

  const selectedBots = await multiSelect(
    "添加哪些机器人？",
    botOptions,
  );

  if (selectedBots.length === 0) {
    error("至少选择一个机器人！");
    return;
  }

  // 选择用户
  const users = await loadUserRecords();
  let selectedUsers: string[] = [];

  if (users.length > 0) {
    const userOptions = users.map((u) => ({
      label: u.username,
      value: u.username,
    }));

    selectedUsers = await multiSelect(
      "添加哪些用户？\n  （回车默认添加全部用户）",
      userOptions,
      true,
    );

    // 如果没有选择，默认全部
    if (selectedUsers.length === 0) {
      selectedUsers = users.map((u) => u.username);
    }
  }

  // requireMention
  const requireMention = await confirm(
    "群内需要 @机器人名 才响应？\n  （选 N：群里所有消息机器人都会回复，适合单机器人群组。\n   选 Y：只有 @机器人名 的消息才回复，适合多机器人群组避免抢答。）",
    selectedBots.length > 1, // 多机器人默认需要 @
  );

  // ----------------------------------------------------------
  // 3. 创建频道
  // ----------------------------------------------------------
  console.log("");
  const allMembers = [...selectedUsers, ...selectedBots];

  step(`创建私有频道「${groupName}」...`);
  try {
    const group = await rc.createGroup(groupName, allMembers);

    // 设置第一个用户为 Owner
    if (selectedUsers.length > 0) {
      step(`设置 ${selectedUsers[0]} 为频道 Owner...`);
      try {
        const userInfo = await rc.getUserInfo(selectedUsers[0]);
        if (userInfo) {
          await rc.groupAddOwner(group._id, userInfo._id);
        }
      } catch {
        // 不影响主流程
      }
    }

    // 只读用户自动禁言
    const userRecords = await loadUserRecords();
    for (const username of selectedUsers) {
      const record = userRecords.find((u) => u.username === username);
      if (record?.permission === "readonly") {
        try {
          const userInfo = await rc.getUserInfo(username);
          if (userInfo) {
            await rc.muteUserInRoom(group._id, userInfo._id);
            info(`  ${username} 已在频道中设为只读`);
          }
        } catch {
          // 禁言失败不影响主流程
        }
      }
    }

    success(`频道「${groupName}」已创建`);
  } catch (err) {
    error(`频道创建失败: ${(err as Error).message}`);
    return;
  }

  // ----------------------------------------------------------
  // 4. 写入配置
  // ----------------------------------------------------------
  step("写入配置...");
  configWriter.addGroup(groupName, selectedBots, requireMention);
  await configWriter.saveAndReload();
  success("配置已更新");

  // ----------------------------------------------------------
  // 5. 完成提示
  // ----------------------------------------------------------
  console.log("");
  success(`私有频道「${groupName}」已创建`);
  if (selectedUsers.length > 0) {
    info(`  Owner: ${selectedUsers[0]}`);
  }
  info(
    `  成员: ${allMembers.join(", ")}`,
  );
  info(`  @提及响应: ${requireMention ? "是" : "否"}`);
  console.log("");
  info("📱 打开 Rocket.Chat App 即可看到频道，开始群聊！");
  console.log("");
}
