// ============================================================
// CLI: openclaw rocketchat setup
// 连接 Rocket.Chat 服务器 + 创建管理员 + 创建用户 + 写入配置
//
// Docker 部署已独立到 install-rc.sh，本命令只负责"连接和配置"
// ============================================================

import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  saveAdminCredentials,
  loadAdminCredentials,
  saveUserRecord,
  generatePassword,
  generateAdminUsername,
  isSetupDone,
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

  console.log("");
  info("本命令用于连接 Rocket.Chat 服务器并配置插件。");
  info("如果还没有部署 Rocket.Chat，请先运行 install-rc.sh：");
  console.log("");
  info("  本机部署:   bash install-rc.sh");
  info("  远程 VPS:   SSH 到 VPS 上运行 bash install-rc.sh");
  info("  指定端口:   RC_PORT=4000 bash install-rc.sh");
  console.log("");

  // ----------------------------------------------------------
  // 1. 输入服务器地址
  // ----------------------------------------------------------
  const serverUrl = await ask(
    "Rocket.Chat 服务器地址\n  （本机部署填 http://127.0.0.1:3000，远程填 http://公网IP:端口）",
    "http://127.0.0.1:3000",
  );

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
    const adminCreated = await createAdminAccount(rc, cleanUrl);
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
  printFinishBanner(cleanUrl, username, port);
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
): Promise<boolean> {
  step("创建管理员（内部使用，你不需要记住）...");

  try {
    let adminResult: { userId: string; authToken: string };
    let savedUsername: string;
    let savedPassword: string;

    // ---------------------------------------------------
    // 策略 1：尝试用已保存的凭据登录（之前 setup 过、中途退出的场景）
    // ---------------------------------------------------
    const savedCreds = await loadAdminCredentials();
    if (savedCreds?.username && savedCreds?.password) {
      try {
        adminResult = await rc.login(savedCreds.username, savedCreds.password);
        savedUsername = savedCreds.username;
        savedPassword = savedCreds.password;
        info("使用已保存的管理员凭据登录成功");

        await saveAdminCredentials({
          userId: adminResult.userId,
          authToken: adminResult.authToken,
          username: savedUsername,
          password: savedPassword,
        });
        rc.setAuth(adminResult.userId, adminResult.authToken);
        success("管理员已就绪");
        return true;
      } catch {
        // 凭据过期或无效，继续尝试其他方式
      }
    }

    // ---------------------------------------------------
    // 策略 2：用默认 admin/admin 登录（全新 RC 的默认账号）
    // ---------------------------------------------------
    try {
      adminResult = await rc.login("admin", "admin");
      savedUsername = "admin";
      savedPassword = "admin";

      await saveAdminCredentials({
        userId: adminResult.userId,
        authToken: adminResult.authToken,
        username: savedUsername,
        password: savedPassword,
      });
      rc.setAuth(adminResult.userId, adminResult.authToken);

      // 安全措施：关闭公开注册
      try {
        await rc.setSetting("Accounts_RegistrationForm", "Disabled");
        info("已自动关闭公开注册（安全）");
      } catch {
        // 忽略
      }

      success("管理员已创建");
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

    // 安全措施：注册完管理员后，自动禁用公开注册
    rc.setAuth(adminResult.userId, adminResult.authToken);
    try {
      await rc.setSetting("Accounts_RegistrationForm", "Disabled");
      info("已自动关闭公开注册（安全）");
    } catch {
      warn("无法自动关闭公开注册，建议在 RC 管理后台手动禁用");
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

/** 创建个人登录账号 */
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
    success(`账号 ${username} 已创建`);
    return true;
  } catch (err) {
    error(`账号创建失败: ${(err as Error).message}`);
    return false;
  }
}

/** 打印完成横幅 */
function printFinishBanner(serverUrl: string, username: string, port: number): void {
  // 如果是 localhost/127.0.0.1，提醒用户手机要用公网 IP
  const isLocal = /localhost|127\.0\.0\.1/.test(serverUrl);

  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          🎉 配置完成！                    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  info("📱 手机操作：");
  info(`   1. App Store 搜索下载 "Rocket.Chat"`);
  if (isLocal) {
    info(`   2. 打开 App，服务器填: http://你的公网IP:${port}`);
    info("      （手机不能用 127.0.0.1，需要填服务器的公网 IP）");
  } else {
    info(`   2. 打开 App，服务器填: ${serverUrl}`);
  }
  if (username) {
    info(`   3. 用户名: ${username}`);
    info("   4. 密码: 你设置的密码");
  }
  console.log("");
  info("🔥 重要：请确保服务器防火墙已放行端口 " + port);
  info(`   阿里云/腾讯云用户请在安全组中添加 TCP ${port} 端口规则`);
  console.log("");
  info("💡 下一步: 运行以下命令添加第一个机器人");
  info("   openclaw rocketchat add-bot");
  console.log("");
}
