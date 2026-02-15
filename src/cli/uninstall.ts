// ============================================================
// CLI: openclaw rocketchat uninstall
// 卸载 Rocket.Chat（清理 OpenClaw 配置 + 凭据 + 提示停止容器）
// ============================================================

import { rm } from "node:fs/promises";
import { ConfigWriter } from "../config/writer.js";
import {
  loadAdminCredentials,
} from "../config/credentials.js";
import {
  confirm,
  heading,
  step,
  success,
  error,
  info,
  warn,
} from "./prompts.js";
import { homedir } from "node:os";
import { join } from "node:path";

export async function uninstallCommand(configPath: string): Promise<void> {
  heading("卸载 Rocket.Chat");

  const adminCreds = await loadAdminCredentials();
  if (!adminCreds) {
    warn("未检测到 Rocket.Chat 配置。");
    return;
  }

  warn("这将清理所有 Rocket.Chat 插件配置和凭据！");
  console.log("");

  const proceed = await confirm("确定要卸载？");
  if (!proceed) {
    info("已取消。");
    return;
  }

  // ----------------------------------------------------------
  // 1. 清理 openclaw.json 中的配置
  // ----------------------------------------------------------
  console.log("");
  step("清理 openclaw.json 中的 rocketchat 配置...");
  try {
    const configWriter = new ConfigWriter(configPath);
    await configWriter.readConfig();
    configWriter.removeRocketchatConfig();
    await configWriter.save();
    success("配置已清理");
  } catch (err) {
    error(`配置清理失败: ${(err as Error).message}`);
  }

  // ----------------------------------------------------------
  // 2. 清理凭据文件
  // ----------------------------------------------------------
  step("清理凭据文件...");
  try {
    const credDir = join(homedir(), ".openclaw", "credentials", "rocketchat");
    await rm(credDir, { recursive: true, force: true });
    success("凭据文件已清理");
  } catch {
    // 不影响
  }

  // ----------------------------------------------------------
  // 3. 提示手动停止 Docker 容器
  // ----------------------------------------------------------
  console.log("");
  success("OpenClaw 端的 Rocket.Chat 配置已完全清理");
  console.log("");
  info("📌 如果你还需要停止 Rocket.Chat Docker 容器，请手动运行：");
  console.log("");
  info("  # 停止容器（保留数据）：");
  info("  cd ~/rocketchat && docker compose down");
  console.log("");
  info("  # 完全删除（包括聊天记录）：");
  info("  cd ~/rocketchat && docker compose down -v");
  info("  rm -rf ~/rocketchat");
  console.log("");
  info("  💡 如果你的 Rocket.Chat 安装在其他目录，请替换 ~/rocketchat 为实际路径。");
  console.log("");
}
