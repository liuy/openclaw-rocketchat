// ============================================================
// 动态导入 OpenClaw 核心模块
// 插件运行在 Gateway 进程内，可以访问 OpenClaw 的内部模块
// 用于入站消息分发（dispatchInboundMessage）
// ============================================================

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

/**
 * OpenClaw 内部模块的动态引用
 */
export interface OpenClawInternals {
  /** 分发入站消息到 Agent */
  dispatchInboundMessage: (params: {
    ctx: Record<string, unknown>;
    cfg: Record<string, unknown>;
    dispatcher: unknown;
    replyOptions?: Record<string, unknown>;
  }) => Promise<unknown>;

  /** 创建回复分发器 */
  createReplyDispatcher: (options: {
    deliver: (
      payload: { text?: string; mediaUrl?: string; mediaUrls?: string[] },
      info: { kind: string },
    ) => void | Promise<void>;
    onError?: (err: unknown) => void;
  }) => unknown;

  /** 创建回复前缀选项（可选） */
  createReplyPrefixOptions?: (params: {
    cfg: Record<string, unknown>;
    agentId?: string;
    channel?: string;
  }) => Record<string, unknown>;

  /** 加载配置 */
  loadConfig: () => Record<string, unknown>;
}

/** 缓存：加载一次就够了 */
let cached: OpenClawInternals | null = null;

/** 用于验证 dist 目录的标记文件 */
const DIST_MARKER = "auto-reply/dispatch.js";

/**
 * 从 Gateway 进程中动态加载 OpenClaw 核心模块
 *
 * 多策略定位 OpenClaw dist/ 目录：
 * 1. require.main.filename — Gateway 主模块入口（最可靠）
 * 2. npm 全局安装模式推导（PREFIX/bin/openclaw → PREFIX/lib/node_modules/openclaw/dist/）
 * 3. process.argv[1] 向上遍历
 * 4. 常见安装路径兜底
 */
export async function loadOpenClawInternals(): Promise<OpenClawInternals | null> {
  if (cached) return cached;

  const distDir = findOpenClawDistDir();
  if (!distDir) {
    console.error(
      `[RC] 无法定位 OpenClaw dist 目录（argv[1]=${process.argv[1]}, main=${require.main?.filename})`,
    );
    return null;
  }

  try {
    const importMod = async (rel: string) => {
      const full = resolve(distDir, rel);
      return await import(pathToFileURL(full).href);
    };

    const dispatchMod = await importMod("auto-reply/dispatch.js");
    const replyDispatcherMod = await importMod(
      "auto-reply/reply/reply-dispatcher.js",
    );
    const configMod = await importMod("config/config.js");

    let replyPrefixMod: Record<string, unknown> | null = null;
    try {
      replyPrefixMod = (await importMod(
        "channels/reply-prefix.js",
      )) as Record<string, unknown>;
    } catch {
      // reply-prefix 是可选的
    }

    cached = {
      dispatchInboundMessage: dispatchMod.dispatchInboundMessage,
      createReplyDispatcher: replyDispatcherMod.createReplyDispatcher,
      createReplyPrefixOptions: replyPrefixMod?.createReplyPrefixOptions as
        | OpenClawInternals["createReplyPrefixOptions"]
        | undefined,
      loadConfig: configMod.loadConfig,
    };

    console.log(`[RC] OpenClaw dist 目录: ${distDir}`);
    return cached;
  } catch (err) {
    console.error(
      `[RC] 无法加载 OpenClaw 内部模块: ${(err as Error).message}`,
    );
    return null;
  }
}

/**
 * 多策略查找 OpenClaw 的 dist/ 目录
 * 兼容 macOS / Linux，兼容 nvm / Homebrew / 系统 Node / 自定义 prefix
 */
function findOpenClawDistDir(): string | null {
  const candidates: string[] = [];

  // ---------- 策略 1: require.main.filename 向上遍历 ----------
  // Gateway 主模块入口，最可靠（平台无关）
  // 例如 PREFIX/lib/node_modules/openclaw/dist/cli/index.js → 向上找到 dist/
  if (require.main?.filename) {
    const found = walkUpForMarker(require.main.filename);
    if (found) return found;
  }

  // ---------- 策略 2: process.execPath 推导 npm prefix ----------
  // Node 二进制所在路径可靠地推算全局 node_modules
  // Linux  : /usr/bin/node                   → /usr/lib/node_modules/openclaw/dist
  // nvm    : ~/.nvm/versions/node/v20/bin/node → ~/.nvm/versions/node/v20/lib/...
  // macOS Homebrew ARM  : /opt/homebrew/bin/node → /opt/homebrew/lib/...
  // macOS Homebrew Intel: /usr/local/bin/node   → /usr/local/lib/...
  // ~/.local: ~/.local/bin/node → ~/.local/lib/...
  if (process.execPath) {
    const nodePrefix = resolve(dirname(process.execPath), "..");
    candidates.push(
      resolve(nodePrefix, "lib", "node_modules", "openclaw", "dist"),
    );
  }

  // ---------- 策略 3: process.argv[1] 推导 npm prefix ----------
  // 二进制入口: PREFIX/bin/openclaw → PREFIX/lib/node_modules/openclaw/dist/
  const binPath = process.argv[1];
  if (binPath) {
    candidates.push(
      resolve(dirname(binPath), "..", "lib", "node_modules", "openclaw", "dist"),
    );
  }

  // ---------- 策略 4: process.argv[1] 向上遍历 ----------
  // 适用于直接执行 dist/cli/index.js 的场景（如开发/调试）
  if (binPath) {
    const found = walkUpForMarker(binPath);
    if (found) return found;
  }

  // ---------- 策略 5: 常见全局安装路径兜底 ----------
  const home = process.env.HOME || (process.platform === "win32" ? process.env.USERPROFILE || "" : "/root");

  // Linux 常见
  candidates.push("/usr/local/lib/node_modules/openclaw/dist");
  candidates.push("/usr/lib/node_modules/openclaw/dist");
  candidates.push(resolve(home, ".local/lib/node_modules/openclaw/dist"));

  // macOS Homebrew (Apple Silicon)
  candidates.push("/opt/homebrew/lib/node_modules/openclaw/dist");

  // nvm（Linux 和 macOS 通用）
  if (process.versions?.node) {
    const nvmDir = process.env.NVM_DIR || resolve(home, ".nvm");
    candidates.push(
      resolve(nvmDir, "versions/node", `v${process.versions.node}`, "lib/node_modules/openclaw/dist"),
    );
  }

  // fnm（macOS / Linux）
  if (process.versions?.node) {
    const fnmDir = process.env.FNM_DIR || resolve(home, ".local/share/fnm");
    candidates.push(
      resolve(fnmDir, "node-versions", `v${process.versions.node}`, "installation/lib/node_modules/openclaw/dist"),
    );
  }

  // npm 自定义 prefix（通过环境变量 npm_config_prefix）
  if (process.env.npm_config_prefix) {
    candidates.push(
      resolve(process.env.npm_config_prefix, "lib", "node_modules", "openclaw", "dist"),
    );
  }

  // 去重后逐个检查
  const seen = new Set<string>();
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (existsSync(resolve(p, DIST_MARKER))) return p;
  }

  return null;
}

/**
 * 从 startPath 所在目录向上遍历，找到包含 DIST_MARKER 的目录
 */
function walkUpForMarker(startPath: string): string | null {
  let dir = dirname(startPath);
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, DIST_MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break; // 已到达文件系统根目录
    dir = parent;
  }
  return null;
}
