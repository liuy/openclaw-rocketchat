// ============================================================
// CLI: openclaw rocketchat setup
// 首次部署 Rocket.Chat + 创建管理员 + 创建用户 + 写入配置
// 支持两种模式：本地 Docker 部署 / 连接远程 RC 服务器
// ============================================================

import { join } from "node:path";
import { DockerManager } from "../docker/manager.js";
import { RocketChatRestClient } from "../rc-api/rest-client.js";
import { ConfigWriter } from "../config/writer.js";
import {
  saveAdminCredentials,
  saveUserRecord,
  generatePassword,
  generateAdminUsername,
  isSetupDone,
  getDockerDir,
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
  heading("Rocket.Chat 部署向导");

  // 检查是否已经 setup 过
  if (isSetupDone()) {
    warn("检测到已有 Rocket.Chat 配置。");
    const proceed = await confirm("要重新部署吗？（会覆盖现有配置）");
    if (!proceed) {
      info("已取消。");
      return;
    }
  }

  // ----------------------------------------------------------
  // 0. 选择部署模式
  // ----------------------------------------------------------
  const deployMode = await select("选择部署方式", [
    {
      label: "本地部署（Docker）—— RC 和 OpenClaw 在同一台机器",
      value: "local",
    },
    {
      label: "连接远程服务器 —— RC 已部署在另一台公网服务器",
      value: "remote",
    },
  ]);

  if (deployMode === "local") {
    await setupLocal(configPath);
  } else {
    await setupRemote(configPath);
  }
}

// ==============================================================
// 本地 Docker 部署
// ==============================================================

async function setupLocal(configPath: string): Promise<void> {
  // ----------------------------------------------------------
  // 1. 环境检测
  // ----------------------------------------------------------
  step("检测环境...");

  const dockerDir = getDockerDir();
  const docker = new DockerManager(dockerDir);

  const dockerCheck = await docker.isDockerInstalled();
  if (!dockerCheck.installed) {
    warn("未检测到 Docker！");
    console.log("");
    info("Docker 是运行 Rocket.Chat 的必备工具，请根据你的系统安装：");
    console.log("");
    info("  📦 Windows / macOS:");
    info("     下载 Docker Desktop: https://www.docker.com/products/docker-desktop/");
    info("     安装后启动 Docker Desktop，然后重新运行本命令。");
    console.log("");
    info("  🐧 Linux (Ubuntu/Debian):");
    info("     curl -fsSL https://get.docker.com | sh");
    info("     sudo usermod -aG docker $USER");
    info("     （注销后重新登录，然后重新运行本命令）");
    console.log("");
    info("  🐧 Linux (CentOS/RHEL):");
    info("     curl -fsSL https://get.docker.com | sh");
    info("     sudo systemctl enable --now docker");
    info("     sudo usermod -aG docker $USER");
    console.log("");
    const tryInstall = await confirm("是否尝试自动安装 Docker？（仅 Linux 有效）");
    if (tryInstall) {
      step("尝试自动安装 Docker...");
      try {
        const { execFile: execFileCb } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFileCb);
        await execFileAsync("sh", ["-c", "curl -fsSL https://get.docker.com | sh"], { timeout: 300000 });
        success("Docker 安装完成！");
        // 重新检测
        const recheck = await docker.isDockerInstalled();
        if (!recheck.installed) {
          error("安装后仍无法检测到 Docker，请手动检查。");
          return;
        }
      } catch (err) {
        error(`自动安装失败: ${(err as Error).message}`);
        info("请按上面的说明手动安装 Docker，然后重新运行本命令。");
        return;
      }
    } else {
      info("请安装 Docker 后重新运行: openclaw rocketchat setup");
      return;
    }
  }
  info(`Docker:          已安装 (v${dockerCheck.version || "latest"})`);

  const composeCheck = await docker.isComposeInstalled();
  if (!composeCheck.installed) {
    error("未检测到 Docker Compose！");
    info("Docker Desktop 自带 Compose。如果你用的是 Linux，请运行：");
    info("  sudo apt install docker-compose-plugin");
    info("或参考: https://docs.docker.com/compose/install/");
    return;
  }
  info(`Docker Compose:  已安装 (v${composeCheck.version})`);

  // ----------------------------------------------------------
  // 2. 用户输入
  // ----------------------------------------------------------

  // 端口
  const portStr = await ask(
    "端口\n  （Rocket.Chat 服务端口，手机连接时需要用到）",
    "3000",
  );
  const port = parseInt(portStr, 10) || 3000;

  if (port < 1 || port > 65535) {
    error("端口号必须在 1-65535 之间！");
    return;
  }

  const portAvailable = await docker.isPortAvailable(port);
  if (!portAvailable) {
    warn(`端口 ${port} 已被占用！`);
    const proceed = await confirm("继续吗？（可能是已运行的 Rocket.Chat）");
    if (!proceed) return;
  } else {
    info(`端口 ${port}:       可用`);
  }

  // 用户账号
  const { username, password } = await promptUserAccount();
  if (!username) return;

  // ----------------------------------------------------------
  // 3. 部署
  // ----------------------------------------------------------
  console.log("");

  // 3.1 生成 Docker 配置
  step("生成 Docker 配置...");
  await docker.generateComposeFile(port);
  success("Docker 配置已生成");

  // 3.2 拉取镜像和启动容器
  step("拉取镜像并启动（首次约 2-5 分钟）...");
  try {
    await docker.start();
  } catch (err) {
    error(`Docker 启动失败: ${(err as Error).message}`);
    info("请检查 Docker 是否正在运行。");
    return;
  }

  // 3.3 等待就绪
  try {
    await docker.waitForReady(port, 120000, (msg) => {
      step(msg);
    });
  } catch (err) {
    error((err as Error).message);
    return;
  }
  success("Rocket.Chat 服务已就绪");

  // ----------------------------------------------------------
  // 4. 创建账号
  // ----------------------------------------------------------
  const serverUrl = `http://127.0.0.1:${port}`;
  const rc = new RocketChatRestClient(serverUrl);

  const adminCreated = await createAdminAccount(rc, serverUrl, port);
  if (!adminCreated) return;

  await createPersonalAccount(rc, username, password!);

  // ----------------------------------------------------------
  // 5. 写入 openclaw.json 配置
  // ----------------------------------------------------------
  step("写入 openclaw.json 配置...");
  const hostIp = docker.getHostIp();
  const publicUrl = `http://${hostIp}:${port}`;

  try {
    const configWriter = new ConfigWriter(configPath);
    await configWriter.readConfig();
    configWriter.setRocketchatChannel(publicUrl, port);
    await configWriter.save();
    success("配置已写入");
  } catch (err) {
    error(`配置写入失败: ${(err as Error).message}`);
    return;
  }

  // ----------------------------------------------------------
  // 6. 完成提示
  // ----------------------------------------------------------
  printFinishBanner(publicUrl, username, port);
}

// ==============================================================
// 远程模式：连接已有的 Rocket.Chat 服务器
// ==============================================================

async function setupRemote(configPath: string): Promise<void> {
  console.log("");
  info("远程模式：连接已部署在其他服务器上的 Rocket.Chat。");
  info("适用场景：");
  info("  - OpenClaw 在家庭内网，RC 在公网 VPS");
  info("  - 服务器内存不足，RC 单独部署在另一台机器");
  info("  - 公司已有 Rocket.Chat 实例");
  console.log("");

  // ----------------------------------------------------------
  // 1. 连接信息
  // ----------------------------------------------------------
  const serverUrl = await ask(
    "远程 Rocket.Chat 服务器地址\n  （例如 http://123.45.67.89:3000 或 https://chat.example.com）",
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

  try {
    const version = await rc.getServerVersion();
    success(`连接成功！Rocket.Chat 版本: ${version}`);
  } catch (err) {
    error(`无法连接到 ${cleanUrl}`);
    info("请检查：");
    info("  1. 服务器地址和端口是否正确");
    info("  2. 服务器是否已启动");
    info("  3. 防火墙是否已放行对应端口");
    info("  4. 如果 OpenClaw 在内网，确保能访问公网地址");
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
    // 从零创建
    const adminCreated = await createAdminAccount(rc, cleanUrl, 0);
    if (!adminCreated) return;
  } else {
    // 使用已有管理员
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
  // 4. 创建个人登录账号
  // ----------------------------------------------------------
  console.log("");
  info("是否需要创建手机登录账号？");
  info("（如果你已有账号，可以跳过这步）");
  console.log("");

  const createAccount = await confirm("创建手机登录账号？");
  let username = "";

  if (createAccount) {
    const result = await promptUserAccount();
    username = result.username;
    if (!username) return;
    await createPersonalAccount(rc, username, result.password!);
  }

  // ----------------------------------------------------------
  // 5. 写入 openclaw.json 配置
  // ----------------------------------------------------------
  step("写入 openclaw.json 配置...");

  // 从 URL 提取端口
  let port = 3000;
  try {
    port = new URL(cleanUrl).port ? parseInt(new URL(cleanUrl).port, 10) : (cleanUrl.startsWith("https") ? 443 : 80);
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
// 公共函数
// ==============================================================

/** 提示输入用户名和密码 */
async function promptUserAccount(): Promise<{ username: string; password: string | null }> {
  console.log("");
  info("创建你的手机登录账号");
  info("（用这个账号在 Rocket.Chat App 上登录）");

  const username = await ask("  用户名");
  if (!username) {
    error("用户名不能为空！");
    return { username: "", password: null };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    error("用户名只能包含英文字母、数字、点、下划线和连字符！");
    return { username: "", password: null };
  }

  const password = await askPassword("  密码");
  if (!password) {
    error("密码不能为空！");
    return { username: "", password: null };
  }
  if (password.length < 6) {
    error("密码至少 6 个字符！");
    return { username: "", password: null };
  }

  const confirmPwd = await askPassword("  确认密码");
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
  port: number,
): Promise<boolean> {
  step("创建管理员（内部使用，你不需要记住）...");
  const adminUsername = generateAdminUsername();
  const adminPassword = generatePassword();
  const adminEmail = `${adminUsername}@openclaw.local`;

  try {
    const adminResult = await rc.login("admin", "admin").catch(async () => {
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
        throw new Error("无法创建管理员账号");
      }

      return rc.login(adminUsername, adminPassword);
    });

    await saveAdminCredentials({
      userId: adminResult.userId,
      authToken: adminResult.authToken,
      username: adminUsername,
      password: adminPassword,
    });
    success("管理员已创建");
    return true;
  } catch (err) {
    error(`管理员创建失败: ${(err as Error).message}`);
    info("你可能需要手动完成 Rocket.Chat 初始化。");
    if (port > 0) {
      info(`访问 http://127.0.0.1:${port} 完成设置向导。`);
    }
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
function printFinishBanner(publicUrl: string, username: string, port: number): void {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          🎉 部署完成！                    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");
  info("📱 手机操作：");
  info(`   1. App Store 搜索下载 "Rocket.Chat"`);
  info(`   2. 打开 App，服务器填: ${publicUrl}`);
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
