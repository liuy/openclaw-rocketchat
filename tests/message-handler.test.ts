// ============================================================
// 消息处理器测试
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageHandler } from "../src/service/message-handler.js";
import type { BotManager } from "../src/service/bot-manager.js";
import type { RcMessage } from "../src/rc-api/types.js";

// Mock BotManager
function createMockBotManager(): BotManager {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    getRestClient: vi.fn().mockReturnValue(null),
    getConnectedBots: vi.fn().mockReturnValue(["molty"]),
    getAgentId: vi.fn().mockReturnValue("main"),
    onMessage: vi.fn(),
    addBot: vi.fn(),
    subscribeRoom: vi.fn(),
    disconnectAll: vi.fn(),
  } as unknown as BotManager;
}

// Mock execFile
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: any, cb: any) => {
    if (cb) cb(null, "", "");
    return {};
  }),
}));

vi.mock("node:util", async () => {
  const actual = await vi.importActual("node:util");
  return {
    ...actual,
    promisify: (fn: any) =>
      (...args: any[]) =>
        new Promise((resolve, reject) => {
          fn(...args, (err: any, ...results: any[]) => {
            if (err) reject(err);
            else resolve(results.length <= 1 ? results[0] : results);
          });
        }),
  };
});

describe("MessageHandler", () => {
  let handler: MessageHandler;
  let mockBot: BotManager;
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    mockBot = createMockBotManager();
    handler = new MessageHandler({
      botManager: mockBot,
      config: {
        accounts: {
          molty: { botUsername: "molty", botDisplayName: "小龙虾" },
        },
        groups: {
          "AI群": { requireMention: true, bots: ["molty"] },
          "自由群": { requireMention: false, bots: ["molty"] },
        },
      },
      logger,
    });
  });

  // ----------------------------------------------------------
  // 出站消息
  // ----------------------------------------------------------
  describe("handleOutbound", () => {
    it("应该通过 BotManager 发送消息", async () => {
      await handler.handleOutbound("Hello!", "molty", "room-1");

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        "molty",
        "room-1",
        "Hello!",
      );
    });

    it("长文本应该分块发送", async () => {
      const longText = "A".repeat(5000);
      await handler.handleOutbound(longText, "molty", "room-1");

      // 应该调用多次 sendMessage
      expect(
        (mockBot.sendMessage as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(1);
    });
  });

  // ----------------------------------------------------------
  // 文本分块
  // ----------------------------------------------------------
  describe("splitText (通过 handleOutbound 间接测试)", () => {
    it("短文本不应分块", async () => {
      await handler.handleOutbound("short text", "molty", "room-1");
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("恰好在长度限制内不分块", async () => {
      const text = "A".repeat(4000);
      await handler.handleOutbound(text, "molty", "room-1");
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
