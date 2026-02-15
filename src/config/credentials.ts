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

/** Docker compose 文件存储目录 */
export function getDockerDir(): string {
  return join(getCredentialsDir(), "docker");
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

/** 保存管理员凭据 */
export async function saveAdminCredentials(
  creds: AdminCredentials,
): Promise<void> {
  const dir = getCredentialsDir();
  await ensureDir(dir);
  await writeSecureFile(
    join(dir, "admin.json"),
    JSON.stringify(creds, null, 2),
  );
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

/** 保存机器人凭据 */
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
// 工具
// ----------------------------------------------------------

/** 生成随机密码 */
export function generatePassword(length = 24): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

/** 生成随机管理员用户名 */
export function generateAdminUsername(): string {
  return `rc-admin-${randomBytes(4).toString("hex")}`;
}

/** 检查凭据是否存在（是否已经 setup 过） */
export function isSetupDone(): boolean {
  return existsSync(join(getCredentialsDir(), "admin.json"));
}
