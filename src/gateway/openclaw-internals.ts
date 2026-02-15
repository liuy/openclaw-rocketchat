// ============================================================
// 动态导入 OpenClaw 核心模块
// 插件运行在 Gateway 进程内，可以访问 OpenClaw 的内部模块
// 用于入站消息分发（dispatchInboundMessage）
// ============================================================

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * OpenClaw 内部模块的动态引用
 * 通过 process.argv[1]（gateway 入口脚本）推算模块路径
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

/**
 * 从 Gateway 进程中动态加载 OpenClaw 核心模块
 *
 * 原理：
 * - Gateway 的入口脚本通常是 dist/cli/index.js（或类似路径）
 * - 从入口脚本路径可以推算 OpenClaw 的 dist/ 根目录
 * - 然后按相对路径导入所需模块
 */
export async function loadOpenClawInternals(): Promise<OpenClawInternals | null> {
  if (cached) return cached;

  const mainScript = process.argv[1];
  if (!mainScript) return null;

  try {
    // 入口脚本: dist/cli/index.js 或 dist/cli/program/index.js
    // 向上遍历找到 dist/ 目录（包含 auto-reply/、config/ 等子目录）
    let distDir = dirname(mainScript);

    // 最多向上走 5 层来找到包含 auto-reply 的目录
    for (let i = 0; i < 5; i++) {
      const testPath = resolve(distDir, "auto-reply", "dispatch.js");
      try {
        const url = pathToFileURL(testPath).href;
        await import(url);
        // 找到了！
        break;
      } catch {
        distDir = dirname(distDir);
      }
    }

    const importModule = async (relativePath: string) => {
      const fullPath = resolve(distDir, relativePath);
      const url = pathToFileURL(fullPath).href;
      return await import(url);
    };

    const dispatchMod = await importModule("auto-reply/dispatch.js");
    const replyDispatcherMod = await importModule(
      "auto-reply/reply/reply-dispatcher.js",
    );
    const configMod = await importModule("config/config.js");

    let replyPrefixMod: Record<string, unknown> | null = null;
    try {
      replyPrefixMod = (await importModule(
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

    return cached;
  } catch (err) {
    // 无法加载内部模块 — 可能是 OpenClaw 版本变化或目录结构不同
    console.error(
      `[RC] 无法加载 OpenClaw 内部模块: ${(err as Error).message}`,
    );
    return null;
  }
}
