// ============================================================
// CLI: openclaw rocketchat setup
// 连接 Rocket.Chat 服务器 + 创建管理员 + 创建用户 + 写入配置
//
// Docker 部署已独立到 install-rc.sh，本命令只负责"连接和配置"
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  saveAdminCredentials,
  loadAdminCredentials,
  saveUserRecord,
  generatePassword,
  generateAdminUsername,
  isSetupDone,
  backupAdminToRcDir,
  backupUserToRcDir,
  restoreUserFromRcDir,
  restoreAdminFromRcDir,
} from "../config/credentials.js";
import {
  ask,
  askPassword,
  confirm,
  select,
  heading,
  step,
  success,
  error,
  warn,
  info,
} from "./prompts.js";

/** install-rc.sh 生成的安装信息 */
interface RcInfo {
  serverUrl?: string;
  adminUser?: string;
  adminPass?: string;
  domain?: string;
  publicIp?: string;
  installDir?: string;
}

/**
 * 尝试从 install-rc.sh 生成的 .rc-info 文件中读取安装信息
 * 查找路径：~/rocketchat/.rc-info（默认安装目录）
 */
function tryLoadRcInfo(): RcInfo | null {
  const candidates = [
    join(homedir(), "rocketchat", ".rc-info"),
    "/root/rocketchat/.rc-info",
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      const info: RcInfo = {};
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        switch (key) {
          case "SERVER_URL": info.serverUrl = val; break;
          case "ADMIN_USER": info.adminUser = val; break;
          case "ADMIN_PASS": info.adminPass = val; break;
          case "DOMAIN": info.domain = val; break;
          case "PUBLIC_IP": info.publicIp = val; break;
          case "INSTALL_DIR": info.installDir = val; break;
        }
      }
      if (info.serverUrl) return info;
    } catch {
      // 忽略读取错误
    }
  }
  return null;
}

export async function setupCommand(configPath: string): Promise<void> {
  heading("Rocket.Chat 配置向导");

  // 检查是否已经 setup 过
  if (isSetupDone()) {
    warn("检测到已有 Rocket.Chat 配置。");
    const proceed = await confirm("要重新配置吗？（会覆盖现有配置）");
    if (!proceed) {
      info("已取消。");
      return;
    }
  }

  // ----------------------------------------------------------
  // 0. 尝试读取 install-rc.sh 保存的安装信息
  // ----------------------------------------------------------
  const rcInfo = tryLoadRcInfo();
  let autoMode = false;
  /** 外部域名（sslip.io），用于最终提示手机连接地址 */
  let externalDomain: string | undefined;

  // ----------------------------------------------------------
  // 1. 确定连接方式 + 服务器地址
  // ----------------------------------------------------------
  let serverUrl: string;

  if (rcInfo) {
    // 能读到 .rc-info → 一定是本机部署
    success("检测到本机 Rocket.Chat 安装信息");
    if (rcInfo.domain) info(`  域名: ${rcInfo.domain}`);
    if (rcInfo.adminUser) info(`  管理员: ${rcInfo.adminUser}`);
    console.log("");

    autoMode = true;
    serverUrl = "https://127.0.0.1";
    externalDomain = rcInfo.domain;
    info(`本机部署，使用 ${serverUrl} 连接`);
  } else {
    // 未检测到本地安装 → 让用户选择连接方式
    console.log("");
    info("本命令用于连接 Rocket.Chat 服务器并配置插件。");
    info("如果还没有部署 Rocket.Chat，请先运行 install-rc.sh：");
    console.log("");
    info("  本机部署:   bash install-rc.sh");
    info("  远程 VPS:   SSH 到 VPS 上运行 bash install-rc.sh");
    console.log("");

    const deployMode = await select("连接方式", [
      { label: "本机部署（Rocket.Chat 在当前服务器上）", value: "local" },
      { label: "远程连接（Rocket.Chat 在其他服务器上）", value: "remote" },
    ]);

    if (deployMode === "local") {
      serverUrl = "https://127.0.0.1";
      info(`本机部署，使用 ${serverUrl} 连接`);
    } else {
      serverUrl = await ask(
        "Rocket.Chat 服务器地址\n  （填 install-rc.sh 输出的 https://xxx.sslip.io 地址）",
        "https://",
      ) || "";
    }
  }

  if (!serverUrl) {
    error("地址不能为空！");
    return;
  }

  // 验证地址格式
  if (!/^https?:\/\/.+/i.test(serverUrl)) {
    error("地址格式不正确！请以 http:// 或 https:// 开头。");
    return;
  }

  // 去除尾部斜杠
  const cleanUrl = serverUrl.replace(/\/+$/, "");

  // ----------------------------------------------------------
  // 2. 连通性测试
  // ----------------------------------------------------------
  step(`测试连接 ${cleanUrl} ...`);
  const rc = new RocketChatRestClient(cleanUrl);

  let rcVersion = "";
  try {
    rcVersion = await rc.getServerVersion();
    success(`连接成功！Rocket.Chat 版本: ${rcVersion}`);
  } catch {
    error(`无法连接到 ${cleanUrl}`);
    info("请检查：");
    info("  1. Rocket.Chat 是否已启动（docker ps 查看）");
    info("  2. 服务器地址和端口是否正确");
    info("  3. 防火墙是否已放行对应端口");
    info("  4. 如果是远程服务器，确保本机能访问该地址");
    console.log("");
    info("💡 还没部署 Rocket.Chat？运行: bash install-rc.sh");
    return;
  }

  // ----------------------------------------------------------
  // 3. 管理员账号
  // ----------------------------------------------------------
  if (autoMode) {
    // 自动模式：直接走"自动创建管理员"路径（内部会尝试 admin/admin）
    const adminCreated = await createAdminAccount(rc, cleanUrl, rcInfo);
    if (!adminCreated) return;
  } else {
    console.log("");
    info("需要一个管理员账号来创建机器人和用户。");

    const adminMode = await select("管理员账号", [
      {
        label: "自动创建新管理员（推荐，适用于新装的 Rocket.Chat）",
        value: "create",
      },
      {
        label: "使用已有管理员账号（适用于已在运行的 Rocket.Chat）",
        value: "existing",
      },
    ]);

    if (adminMode === "create") {
      const adminCreated = await createAdminAccount(rc, cleanUrl, rcInfo);
      if (!adminCreated) return;
    } else {
      const existingAdminUser = await ask("管理员用户名");
      const existingAdminPass = await askPassword("管理员密码");
      if (!existingAdminUser || !existingAdminPass) {
        error("用户名和密码不能为空！");
        return;
      }

      step("验证管理员身份...");
      try {
        const authResult = await rc.login(existingAdminUser, existingAdminPass);
        await saveAdminCredentials({
          userId: authResult.userId,
          authToken: authResult.authToken,
          username: existingAdminUser,
          password: existingAdminPass,
        });
        success("管理员身份验证成功");
      } catch (err) {
        error(`登录失败: ${(err as Error).message}`);
        info("请检查用户名和密码是否正确，以及该账号是否具有管理员权限。");
        return;
      }
    }
  }

  // ----------------------------------------------------------
  // 3.5 清理默认的 general 频道（避免用户看到管理员账号）
  // ----------------------------------------------------------
  try {
    const general = await rc.getChannelInfo("general");
    if (general) {
      await rc.deleteChannel(general._id);
      info("已清理默认 general 频道");
    }
  } catch {
    // 可能已经被删除或无权限，忽略
  }

  // ----------------------------------------------------------
  // 4. 创建手机登录账号
  // ----------------------------------------------------------
  console.log("");
  const { username, password } = await promptUserAccount();
  if (!username) return;

  await createPersonalAccount(rc, username, password!);

  // ----------------------------------------------------------
  // 5. 写入 openclaw.json 配置
  // ----------------------------------------------------------
  step("写入 openclaw.json 配置...");

  // 从 URL 提取端口
  let port = 3000;
  try {
    const url = new URL(cleanUrl);
    port = url.port ? parseInt(url.port, 10) : (cleanUrl.startsWith("https") ? 443 : 80);
  } catch {
    // 保持默认
  }

  try {
    const configWriter = new ConfigWriter(configPath);
    await configWriter.readConfig();
    configWriter.setRocketchatChannel(cleanUrl, port);
    await configWriter.save();
    success("配置已写入");
  } catch (err) {
    error(`配置写入失败: ${(err as Error).message}`);
    return;
  }

  // ----------------------------------------------------------
  // 6. 完成提示
  // ----------------------------------------------------------
  printFinishBanner(cleanUrl, username, port, externalDomain);
}

// ==============================================================
// 辅助函数
// ==============================================================

/** 提示输入用户名和密码 */
async function promptUserAccount(): Promise<{ username: string; password: string | null }> {
  info("创建你的手机登录账号");
  info("（用这个账号在 Rocket.Chat App 上登录）");
  console.log("");

  const username = await ask("用户名");
  if (!username) {
    error("用户名不能为空！");
    return { username: "", password: null };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    error("用户名只能包含英文字母、数字、点、下划线和连字符！");
    return { username: "", password: null };
  }

  const password = await askPassword("密码");
  if (!password) {
    error("密码不能为空！");
    return { username: "", password: null };
  }
  if (password.length < 6) {
    error("密码至少 6 个字符！");
    return { username: "", password: null };
  }

  const confirmPwd = await askPassword("确认密码");
  if (password !== confirmPwd) {
    error("两次密码不一致！");
    return { username: "", password: null };
  }

  return { username, password };
}

/** 创建管理员账号 */
async function createAdminAccount(
  rc: RocketChatRestClient,
  serverUrl: string,
  rcInfo?: RcInfo | null,
): Promise<boolean> {
  step("创建管理员（内部使用，你不需要记住）...");

  /** 通用登录 + 保存逻辑 */
  async function tryLogin(
    user: string,
    pass: string,
    label: string,
  ): Promise<boolean> {
    try {
      const result = await rc.login(user, pass);
      info(`${label}登录成功`);
      await saveAdminCredentials({
        userId: result.userId,
        authToken: result.authToken,
        username: user,
        password: pass,
      });
      rc.setAuth(result.userId, result.authToken);
      success("管理员已就绪");
      return true;
    } catch {
      return false;
    }
  }

  try {
    let adminResult: { userId: string; authToken: string };
    let savedUsername: string;
    let savedPassword: string;

    // ---------------------------------------------------
    // 策略 1：尝试用已保存的凭据登录（之前 setup 过、中途退出的场景）
    // ---------------------------------------------------
    const savedCreds = await loadAdminCredentials();
    if (savedCreds?.username && savedCreds?.password) {
      if (await tryLogin(savedCreds.username, savedCreds.password, "使用已保存的管理员凭据")) {
        return true;
      }
    }

    // ---------------------------------------------------
    // 策略 1b：从 RC 安装目录备份恢复凭据（插件重装后凭据丢失的场景）
    // ---------------------------------------------------
    const backupCreds = await restoreAdminFromRcDir();
    if (backupCreds?.username && backupCreds?.password) {
      if (await tryLogin(backupCreds.username, backupCreds.password, "从备份恢复管理员凭据")) {
        return true;
      }
    }

    // ---------------------------------------------------
    // 策略 1c：用 .rc-info 中的管理员密码登录（install-rc.sh 保存的密码）
    // ---------------------------------------------------
    if (rcInfo?.adminUser && rcInfo?.adminPass) {
      if (await tryLogin(rcInfo.adminUser, rcInfo.adminPass, "使用安装信息中的管理员凭据")) {
        return true;
      }
    }

    // ---------------------------------------------------
    // 策略 2：用默认 admin/admin 登录（全新 RC 的默认账号）
    //         登录后立即改为强随机密码（消除弱口令风险）
    // ---------------------------------------------------
    try {
      adminResult = await rc.login("admin", "admin");
      savedUsername = "admin";
      rc.setAuth(adminResult.userId, adminResult.authToken);

      // 安全措施 1：立即修改默认弱密码
      const strongPassword = generatePassword();
      try {
        await rc.updateUserPassword(adminResult.userId, strongPassword);
        savedPassword = strongPassword;
        info("已将默认管理员密码修改为强随机密码（安全）");
      } catch {
        // 改密码失败时保留原密码，不阻断流程
        savedPassword = "admin";
        warn("默认管理员密码修改失败，建议手动修改。");
      }

      await saveAdminCredentials({
        userId: adminResult.userId,
        authToken: adminResult.authToken,
        username: savedUsername,
        password: savedPassword,
      });

      // 安全措施 2：关闭公开注册 + 禁用邮箱二次验证
      try {
        await rc.setSetting("Accounts_RegistrationForm", "Disabled");
        info("已自动关闭公开注册（安全）");
      } catch {
        // 忽略
      }
      try {
        await rc.setSetting("Accounts_TwoFactorAuthentication_By_Email_Enabled", false);
      } catch {
        // 忽略
      }

      success("管理员已就绪");
      return true;
    } catch {
      // admin/admin 不可用，继续
    }

    // ---------------------------------------------------
    // 策略 3：通过注册接口创建新管理员
    // ---------------------------------------------------
    const adminUsername = generateAdminUsername();
    const adminPassword = generatePassword();
    const adminEmail = `${adminUsername}@openclaw.local`;

    const response = await fetch(`${serverUrl}/api/v1/users.register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: adminUsername,
        email: adminEmail,
        pass: adminPassword,
        name: "RC Admin",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
      const errorMsg = (errorData as Record<string, string>).error || "注册失败";

      if (errorMsg.includes("registration-disabled") || errorMsg.includes("Registration")) {
        // 注册被禁用 — 说明之前创建过管理员但凭据丢失
        error("注册已被禁用，且没有找到可用的管理员凭据。");
        info("这通常是因为之前运行过 setup 并创建了管理员。");
        console.log("");
        info("解决方案（任选一种）：");
        info("  1. 选择「使用已有管理员账号」，手动输入你的管理员账号密码");
        info("  2. 如果忘记了管理员密码，重置 Rocket.Chat：");
        info(`     cd ~/rocketchat && docker compose down -v`);
        info("     然后重新运行 install-rc.sh 和 setup");
        return false;
      }

      throw new Error(`无法创建管理员账号: ${errorMsg}`);
    }

    adminResult = await rc.login(adminUsername, adminPassword);
    savedUsername = adminUsername;
    savedPassword = adminPassword;

    await saveAdminCredentials({
      userId: adminResult.userId,
      authToken: adminResult.authToken,
      username: savedUsername,
      password: savedPassword,
    });

    // 安全措施：注册完管理员后，自动禁用公开注册 + 禁用邮箱二次验证
    rc.setAuth(adminResult.userId, adminResult.authToken);
    try {
      await rc.setSetting("Accounts_RegistrationForm", "Disabled");
      info("已自动关闭公开注册（安全）");
    } catch {
      warn("无法自动关闭公开注册，建议在 RC 管理后台手动禁用");
    }
    try {
      await rc.setSetting("Accounts_TwoFactorAuthentication_By_Email_Enabled", false);
      info("已禁用邮箱二次验证");
    } catch {
      // 忽略
    }

    success("管理员已创建");
    return true;
  } catch (err) {
    error(`管理员创建失败: ${(err as Error).message}`);
    info("你可能需要手动完成 Rocket.Chat 初始化。");
    info(`访问 ${serverUrl} 完成设置向导后重新运行 setup。`);
    return false;
  }
}

/** 创建个人登录账号（支持冲突恢复） */
async function createPersonalAccount(
  rc: RocketChatRestClient,
  username: string,
  password: string,
): Promise<boolean> {
  step(`创建账号 ${username}...`);
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
    await saveUserRecord(username);
    await backupUserToRcDir(username, password);
    success(`账号 ${username} 已创建`);
    return true;
  } catch (err) {
    const msg = (err as Error).message || "";

    // 用户名已被占用 — 尝试从备份恢复
    if (msg.includes("already in use") || msg.includes("already exists") || msg.includes("Username is already")) {
      warn(`用户名 ${username} 在 Rocket.Chat 中已存在。`);

      const backup = await restoreUserFromRcDir(username);
      if (backup) {
        info(`从安装备份中找到 ${username} 的密码，尝试验证...`);
        try {
          await rc.login(username, backup.password);
          await saveUserRecord(username);
          success(`已恢复账号 ${username}（使用备份密码）`);
          info("你的手机登录密码与上次相同。");
          return true;
        } catch {
          warn("备份密码验证失败，可能已被修改。");
        }
      }

      // 备份也没有 — 尝试用用户输入的密码登录
      info("尝试用你输入的密码登录...");
      try {
        await rc.login(username, password);
        await saveUserRecord(username);
        await backupUserToRcDir(username, password);
        success(`账号 ${username} 验证成功（密码匹配）`);
        return true;
      } catch {
        // 密码不匹配
      }

      // 最后手段：用管理员权限重置密码
      info("密码不匹配，使用管理员权限重置密码...");
      try {
        const userInfo = await rc.getUserInfo(username);
        if (userInfo) {
          await rc.updateUserPassword(userInfo._id, password);
          await saveUserRecord(username);
          await backupUserToRcDir(username, password);
          success(`已重置 ${username} 的密码`);
          return true;
        }
      } catch (resetErr) {
        error(`密码重置失败: ${(resetErr as Error).message}`);
      }

      error(`无法恢复账号 ${username}。你可以在 Rocket.Chat 管理后台手动重置密码。`);
      return false;
    }

    error(`账号创建失败: ${msg}`);
    return false;
  }
}

/** 打印完成横幅 */
function printFinishBanner(
  serverUrl: string,
  username: string,
  _port: number,
  externalDomain?: string,
): void {
  // 如果是 localhost/127.0.0.1，提醒用户手机要用公网 IP
  const isLocal = /localhost|127\.0\.0\.1/.test(serverUrl);

  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          🎉 配置完成！                    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  info("📱 手机操作：");
  info(`   1. App Store 搜索下载 "Rocket.Chat"`);
  if (isLocal && externalDomain) {
    info(`   2. 打开 App，服务器填: https://${externalDomain}`);
    info("      （手机不能用 127.0.0.1，需要填 sslip.io 域名）");
  } else if (isLocal) {
    info(`   2. 打开 App，服务器填: install-rc.sh 输出的 https://xxx.sslip.io 地址`);
    info("      （手机不能用 127.0.0.1，需要填 sslip.io 域名或服务器公网 IP）");
  } else {
    info(`   2. 打开 App，服务器填: ${serverUrl}`);
  }
  if (username) {
    info(`   3. 用户名: ${username}`);
    info("   4. 密码: 你设置的密码");
  }
  console.log("");
  info("💡 关于 App 中可能看到的 admin 或 rc-admin 用户：");
  info("   这是 Rocket.Chat 的内部管理员账号，由 setup 自动创建/接管，");
  info("   用于管理机器人和用户。你无需理会，也不要删除它。");
  console.log("");
  info("🔥 重要：请确保服务器防火墙已放行端口 443 和 80");
  info("   阿里云/腾讯云用户请在安全组中添加 TCP 443 和 80 端口规则");
  console.log("");
  info("💡 下一步: 运行以下命令添加第一个机器人");
  info("   openclaw rocketchat add-bot");
  console.log("");
}
