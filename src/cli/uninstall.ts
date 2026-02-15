// ============================================================
// CLI: openclaw rocketchat uninstall
// 卸载 Rocket.Chat（停止容器、清理配置）
// ============================================================

import { rm } from "node:fs/promises";
import { DockerManager } from "../docker/manager.js";
import { ConfigWriter } from "../config/writer.js";
import {
  getDockerDir,
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
    warn("未检测到 Rocket.Chat 安装。");
    return;
  }

  warn("这将停止并移除 Rocket.Chat 容器！");
  console.log("");

  const proceed = await confirm("确定要卸载？");
  if (!proceed) {
    info("已取消。");
    return;
  }

  const deleteData = await confirm("是否删除所有数据（聊天记录）？");

  // ----------------------------------------------------------
  // 1. 停止并移除容器
  // ----------------------------------------------------------
  console.log("");
  const dockerDir = getDockerDir();
  const docker = new DockerManager(dockerDir);

  if (docker.composeFileExists()) {
    step("停止容器...");
    try {
      await docker.remove(deleteData);
      success("容器已移除");
    } catch (err) {
      error(`容器移除失败: ${(err as Error).message}`);
      info("请手动运行: docker compose down");
    }
  }

  // ----------------------------------------------------------
  // 2. 清理配置
  // ----------------------------------------------------------
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
  // 3. 清理凭据文件
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
  // 完成
  // ----------------------------------------------------------
  console.log("");
  success("Rocket.Chat 已卸载");
  if (!deleteData) {
    info("  数据卷已保留，彻底清除请运行:");
    info("  docker volume rm openclaw-rc_mongodb_data");
  }
  console.log("");
}
