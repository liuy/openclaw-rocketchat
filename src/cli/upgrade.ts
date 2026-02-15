// ============================================================
// CLI: openclaw rocketchat upgrade
// 一键升级插件：备份配置 → 删旧版 → 清验证障碍 → 安装新版 → 恢复配置
// ============================================================

import { rm } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  confirm,
  heading,
  step,
  success,
  error,
  info,
  warn,
} from "./prompts.js";

/** 读取 JSON 配置 */
function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** 写入 JSON 配置 */
function writeJson(path: string, data: Record<string, any>): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function upgradeCommand(configPath: string): Promise<void> {
  heading("升级 openclaw-rocketchat 插件");

  const extensionDir = join(
    homedir(),
    ".openclaw",
    "extensions",
    "openclaw-rocketchat",
  );

  // ----------------------------------------------------------
  // 0. 检查前置条件
  // ----------------------------------------------------------
  if (!existsSync(configPath)) {
    error(`配置文件不存在: ${configPath}`);
    return;
  }

  // 获取当前版本
  let currentVersion = "(未知)";
  const extPkgPath = join(extensionDir, "package.json");
  if (existsSync(extPkgPath)) {
    try {
      const pkg = readJson(extPkgPath);
      currentVersion = pkg.version || currentVersion;
    } catch {
      // 忽略
    }
  }

  // 查询 npm 最新版本
  let latestVersion = "(查询中...)";
  try {
    latestVersion = execSync("npm view openclaw-rocketchat version", {
      encoding: "utf-8",
      timeout: 15000,
    }).trim();
  } catch {
    warn("无法查询最新版本，将继续升级");
  }

  info(`当前版本: ${currentVersion}`);
  info(`最新版本: ${latestVersion}`);
  console.log("");

  if (currentVersion === latestVersion) {
    info("已是最新版本，无需升级。");
    const forceUpgrade = await confirm("仍要强制重装？");
    if (!forceUpgrade) {
      return;
    }
  }

  const proceed = await confirm(
    `升级到 ${latestVersion}？（升级期间会短暂停止 Gateway）`,
  );
  if (!proceed) {
    info("已取消。");
    return;
  }

  console.log("");

  // ----------------------------------------------------------
  // 1. 备份配置
  // ----------------------------------------------------------
  step("备份 Rocket.Chat 配置...");

  let savedChannelConfig: any = null;
  let savedBindings: any[] = [];
  let savedPluginInstall: any = null;

  try {
    const config = readJson(configPath);

    // 备份 channels.rocketchat
    savedChannelConfig = config.channels?.rocketchat || null;

    // 备份 rocketchat 相关的 bindings
    savedBindings = (config.bindings || []).filter(
      (b: any) => b.match?.channel === "rocketchat",
    );

    // 备份 plugins.installs 记录
    savedPluginInstall =
      config.plugins?.installs?.["openclaw-rocketchat"] || null;

    if (savedChannelConfig) {
      success(
        `已备份: channels.rocketchat (${Object.keys(savedChannelConfig.accounts || {}).length} 个机器人, ${Object.keys(savedChannelConfig.groups || {}).length} 个群组)`,
      );
    } else {
      warn("未找到 channels.rocketchat 配置（新安装？）");
    }

    if (savedBindings.length > 0) {
      success(`已备份: ${savedBindings.length} 条 binding 规则`);
    }
  } catch (err) {
    error(`备份失败: ${(err as Error).message}`);
    return;
  }

  // ----------------------------------------------------------
  // 2. 停止 Gateway
  // ----------------------------------------------------------
  step("停止 Gateway...");
  try {
    execSync("openclaw gateway stop", {
      encoding: "utf-8",
      timeout: 30000,
      stdio: "pipe",
    });
    success("Gateway 已停止");
  } catch {
    // 可能本来就没运行
    info("Gateway 未运行或已停止");
  }

  // ----------------------------------------------------------
  // 3. 删除旧插件目录
  // ----------------------------------------------------------
  step("删除旧版插件...");
  try {
    await rm(extensionDir, { recursive: true, force: true });
    success("旧版插件已删除");
  } catch (err) {
    error(`删除失败: ${(err as Error).message}`);
    warn("请手动删除后重试: rm -rf " + extensionDir);
    return;
  }

  // ----------------------------------------------------------
  // 4. 临时清理配置（绕过验证）
  // ----------------------------------------------------------
  step("临时清理配置以通过安装验证...");
  try {
    const config = readJson(configPath);

    // 暂时移除 channels.rocketchat（安装时验证会失败）
    if (config.channels) {
      delete config.channels.rocketchat;
    }

    // 移除幽灵 entries
    const entries = config.plugins?.entries || {};
    delete entries["rocketchat"];
    delete entries["openclaw-rocketchat"];

    writeJson(configPath, config);
    success("配置已临时清理");
  } catch (err) {
    error(`清理配置失败: ${(err as Error).message}`);
    warn("尝试继续安装...");
  }

  // ----------------------------------------------------------
  // 5. 安装新版
  // ----------------------------------------------------------
  step("安装新版插件...");
  try {
    // 显式指定版本号，避免 npm 缓存导致装回旧版本
    const installPkg = latestVersion && latestVersion !== "(查询中...)"
      ? `openclaw-rocketchat@${latestVersion}`
      : "openclaw-rocketchat@latest";
    const output = execSync(`openclaw plugins install ${installPkg}`, {
      encoding: "utf-8",
      timeout: 120000,
      stdio: "pipe",
    });
    // 检查是否真的安装成功
    if (existsSync(extensionDir)) {
      success("新版插件安装成功");
    } else {
      error("安装命令执行完毕但插件目录不存在");
      error(output);
      warn("请手动排查后重试");
      // 仍然尝试恢复配置
    }
  } catch (err) {
    error(`安装失败: ${(err as Error).message}`);
    warn("尝试恢复配置...");
  }

  // ----------------------------------------------------------
  // 6. 恢复配置
  // ----------------------------------------------------------
  step("恢复 Rocket.Chat 配置...");
  try {
    // 重新读取（安装可能已经修改了配置文件）
    const config = readJson(configPath);

    // 恢复 channels.rocketchat
    if (savedChannelConfig) {
      config.channels = config.channels || {};
      config.channels.rocketchat = savedChannelConfig;
      success("已恢复 channels.rocketchat");
    }

    // 恢复 bindings
    if (savedBindings.length > 0) {
      const currentBindings: any[] = config.bindings || [];
      for (const binding of savedBindings) {
        const exists = currentBindings.some(
          (b: any) =>
            b.agentId === binding.agentId &&
            b.match?.channel === binding.match?.channel &&
            b.match?.accountId === binding.match?.accountId,
        );
        if (!exists) {
          currentBindings.push(binding);
        }
      }
      config.bindings = currentBindings;
      success(`已恢复 ${savedBindings.length} 条 binding`);
    }

    // 添加 "rocketchat" 别名条目
    // 框架 doctor 会根据 channels.rocketchat 查找 plugins.entries.rocketchat，
    // 如果不存在就反复提示。添加别名 + 匹配的 installs 记录，让 doctor 和验证都通过。
    ensurePluginAlias(config);

    writeJson(configPath, config);
    success("配置恢复完成");
  } catch (err) {
    error(`配置恢复失败: ${(err as Error).message}`);
    warn("请手动恢复 channels.rocketchat 配置");
  }

  // ----------------------------------------------------------
  // 7. 显示结果
  // ----------------------------------------------------------
  console.log("");

  // 读取新版本号
  let newVersion = latestVersion;
  if (existsSync(extPkgPath)) {
    try {
      const pkg = readJson(extPkgPath);
      newVersion = pkg.version || newVersion;
    } catch {
      // 忽略
    }
  }

  success(`✅ 升级完成: ${currentVersion} → ${newVersion}`);
  console.log("");
  info("启动 Gateway：");
  info("  openclaw gateway start");
  info("  # 或前台运行查看日志：");
  info("  openclaw gateway run --verbose");
  console.log("");
}

/**
 * 确保 plugins.entries 和 plugins.installs 中同时存在
 * "openclaw-rocketchat" 和 "rocketchat" 两个条目。
 *
 * 原因：框架 doctor 根据 channels.rocketchat 查找 plugins.entries.rocketchat，
 * 但 npm 安装只创建 plugins.entries.openclaw-rocketchat。
 * 缺少 "rocketchat" 条目会导致 doctor 反复提示，且 doctor --fix 因验证失败而报错。
 */
function ensurePluginAlias(config: Record<string, any>): void {
  config.plugins = config.plugins || {};
  config.plugins.entries = config.plugins.entries || {};
  config.plugins.installs = config.plugins.installs || {};

  // entries 别名
  if (!config.plugins.entries["rocketchat"]) {
    config.plugins.entries["rocketchat"] = { enabled: true };
  }

  // installs 别名（指向同一个安装路径，让验证通过）
  const realInstall = config.plugins.installs["openclaw-rocketchat"];
  if (realInstall && !config.plugins.installs["rocketchat"]) {
    config.plugins.installs["rocketchat"] = { ...realInstall };
  }
}
