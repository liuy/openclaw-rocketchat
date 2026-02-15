// ============================================================
// 凭据存储管理
// 敏感信息存储在 ~/.openclaw/credentials/rocketchat/
// ============================================================

import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { randomBytes } from "node:crypto";
import type { AdminCredentials, BotCredentials, UserRecord } from "../rc-api/types.js";

/** 凭据存储根目录 */
function getCredentialsDir(): string {
  return join(homedir(), ".openclaw", "credentials", "rocketchat");
}

/** 确保目录存在，macOS/Linux 上设置 0o700 权限 */
async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}

/**
 * 写入敏感文件
 * macOS/Linux 上自动设置 0o600 权限（仅文件所有者可读写）
 */
async function writeSecureFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf-8");
  if (platform() !== "win32") {
    await chmod(filePath, 0o600);
  }
}

// ----------------------------------------------------------
// 管理员凭据
// ----------------------------------------------------------

/** 保存管理员凭据（同时备份到 RC 安装目录） */
export async function saveAdminCredentials(
  creds: AdminCredentials,
): Promise<void> {
  const dir = getCredentialsDir();
  await ensureDir(dir);
  await writeSecureFile(
    join(dir, "admin.json"),
    JSON.stringify(creds, null, 2),
  );
  // 自动备份到 RC 安装目录
  await backupAdminToRcDir(creds);
}

/** 读取管理员凭据 */
export async function loadAdminCredentials(): Promise<AdminCredentials | null> {
  const file = join(getCredentialsDir(), "admin.json");
  if (!existsSync(file)) return null;
  try {
    const content = await readFile(file, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`[rocketchat] 读取管理员凭据失败: ${(err as Error).message}`);
    return null;
  }
}

// ----------------------------------------------------------
// 机器人凭据
// ----------------------------------------------------------

/** 保存机器人凭据（同时备份到 RC 安装目录） */
export async function saveBotCredentials(
  botUsername: string,
  userId: string,
  password: string,
): Promise<void> {
  const dir = getCredentialsDir();
  await ensureDir(dir);
  const file = join(dir, "bots.json");

  let bots: BotCredentials = {};
  if (existsSync(file)) {
    try {
      bots = JSON.parse(await readFile(file, "utf-8"));
    } catch {
      bots = {};
    }
  }

  bots[botUsername] = { userId, password };
  await writeSecureFile(file, JSON.stringify(bots, null, 2));
  // 自动备份到 RC 安装目录
  await backupBotToRcDir(botUsername, userId, password);
}

/** 读取所有机器人凭据 */
export async function loadBotCredentials(): Promise<BotCredentials> {
  const file = join(getCredentialsDir(), "bots.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch (err) {
    console.error(`[rocketchat] 读取机器人凭据失败: ${(err as Error).message}`);
    return {};
  }
}

/** 移除机器人凭据 */
export async function removeBotCredential(
  botUsername: string,
): Promise<void> {
  const file = join(getCredentialsDir(), "bots.json");
  if (!existsSync(file)) return;
  try {
    const bots: BotCredentials = JSON.parse(await readFile(file, "utf-8"));
    delete bots[botUsername];
    await writeSecureFile(file, JSON.stringify(bots, null, 2));
  } catch {
    // 忽略
  }
}

// ----------------------------------------------------------
// 用户记录
// ----------------------------------------------------------

/** 保存用户记录 */
export async function saveUserRecord(
  username: string,
  permission: "full" | "readonly" = "full",
): Promise<void> {
  const dir = getCredentialsDir();
  await ensureDir(dir);
  const file = join(dir, "users.json");

  let users: UserRecord[] = [];
  if (existsSync(file)) {
    try {
      users = JSON.parse(await readFile(file, "utf-8"));
    } catch {
      users = [];
    }
  }

  const existing = users.find((u) => u.username === username);
  if (existing) {
    existing.permission = permission;
  } else {
    users.push({ username, createdAt: new Date().toISOString(), permission });
  }
  await writeSecureFile(file, JSON.stringify(users, null, 2));
}

/** 读取用户记录 */
export async function loadUserRecords(): Promise<UserRecord[]> {
  const file = join(getCredentialsDir(), "users.json");
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return [];
  }
}

/** 移除用户记录 */
export async function removeUserRecord(username: string): Promise<void> {
  const file = join(getCredentialsDir(), "users.json");
  if (!existsSync(file)) return;
  try {
    let users: UserRecord[] = JSON.parse(await readFile(file, "utf-8"));
    users = users.filter((u) => u.username !== username);
    await writeSecureFile(file, JSON.stringify(users, null, 2));
  } catch {
    // 文件损坏时忽略
  }
}

// ----------------------------------------------------------
// RC 安装目录备份（持久化到 ~/rocketchat/.rc-credentials）
// 插件重装不会丢失，因为 ~/rocketchat/ 是 Docker 安装目录
// ----------------------------------------------------------

/** 备份文件结构 */
interface RcCredentialsBackup {
  admin?: AdminCredentials;
  bots?: BotCredentials;
  users?: Array<UserRecord & { password?: string }>;
  updatedAt?: string;
}

/** 获取备份文件路径 */
function getBackupPath(): string {
  return join(homedir(), "rocketchat", ".rc-credentials");
}

/** 读取备份文件 */
async function loadBackup(): Promise<RcCredentialsBackup> {
  const file = getBackupPath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return {};
  }
}

/** 写入备份文件 */
async function saveBackup(data: RcCredentialsBackup): Promise<void> {
  const file = getBackupPath();
  const dir = join(homedir(), "rocketchat");
  if (!existsSync(dir)) return; // RC 安装目录不存在则跳过
  data.updatedAt = new Date().toISOString();
  await writeSecureFile(file, JSON.stringify(data, null, 2));
}

/** 备份管理员凭据到 RC 安装目录 */
export async function backupAdminToRcDir(creds: AdminCredentials): Promise<void> {
  try {
    const backup = await loadBackup();
    backup.admin = creds;
    await saveBackup(backup);
  } catch {
    // 备份失败不阻断主流程
  }
}

/** 备份机器人凭据到 RC 安装目录 */
export async function backupBotToRcDir(
  botUsername: string,
  userId: string,
  password: string,
): Promise<void> {
  try {
    const backup = await loadBackup();
    if (!backup.bots) backup.bots = {};
    backup.bots[botUsername] = { userId, password };
    await saveBackup(backup);
  } catch {
    // 备份失败不阻断主流程
  }
}

/** 备份用户凭据到 RC 安装目录（含密码） */
export async function backupUserToRcDir(
  username: string,
  password: string,
): Promise<void> {
  try {
    const backup = await loadBackup();
    if (!backup.users) backup.users = [];
    const existing = backup.users.find((u) => u.username === username);
    if (existing) {
      existing.password = password;
    } else {
      backup.users.push({
        username,
        password,
        createdAt: new Date().toISOString(),
        permission: "full",
      });
    }
    await saveBackup(backup);
  } catch {
    // 备份失败不阻断主流程
  }
}

/** 从 RC 安装目录恢复管理员凭据 */
export async function restoreAdminFromRcDir(): Promise<AdminCredentials | null> {
  try {
    const backup = await loadBackup();
    return backup.admin || null;
  } catch {
    return null;
  }
}

/** 从 RC 安装目录恢复机器人凭据 */
export async function restoreBotFromRcDir(botUsername: string): Promise<{ userId: string; password: string } | null> {
  try {
    const backup = await loadBackup();
    const bot = backup.bots?.[botUsername];
    if (bot?.password) return { userId: bot.userId, password: bot.password };
    return null;
  } catch {
    return null;
  }
}

/** 从 RC 安装目录恢复用户凭据 */
export async function restoreUserFromRcDir(username: string): Promise<{ password: string } | null> {
  try {
    const backup = await loadBackup();
    const user = backup.users?.find((u) => u.username === username);
    if (user?.password) return { password: user.password };
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------
// 工具
// ----------------------------------------------------------

/** 生成随机密码（满足 RC 默认密码策略：大小写+数字+特殊字符） */
export function generatePassword(length = 24): string {
  const base = randomBytes(length).toString("base64url").slice(0, length - 4);
  // 确保包含大写、小写、数字、特殊字符
  return `${base}Ax1!`;
}

/** 生成随机管理员用户名 */
export function generateAdminUsername(): string {
  return `rc-admin-${randomBytes(4).toString("hex")}`;
}

/** 检查凭据是否存在（是否已经 setup 过） */
export function isSetupDone(): boolean {
  return existsSync(join(getCredentialsDir(), "admin.json"));
}
