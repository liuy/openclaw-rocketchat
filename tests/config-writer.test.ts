// ============================================================
// 配置读写模块测试
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigWriter } from "../src/config/writer.js";

describe("ConfigWriter", () => {
  let tmpDir: string;
  let configPath: string;
  let writer: ConfigWriter;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `openclaw-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    configPath = join(tmpDir, "openclaw.json");
    writer = new ConfigWriter(configPath);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ----------------------------------------------------------
  // 读取
  // ----------------------------------------------------------
  describe("readConfig", () => {
    it("配置文件不存在时返回空对象", async () => {
      const config = await writer.readConfig();
      expect(config).toEqual({});
    });

    it("能正确读取 JSON 配置", async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          agents: { list: [{ id: "main", default: true }] },
          channels: {},
        }),
        "utf-8",
      );

      const config = await writer.readConfig();
      expect(config.agents?.list?.[0]?.id).toBe("main");
    });
  });

  // ----------------------------------------------------------
  // Agent 列表
  // ----------------------------------------------------------
  describe("getAgentsList", () => {
    it("没有 agents 时返回空数组", async () => {
      await writer.readConfig();
      expect(writer.getAgentsList()).toEqual([]);
    });

    it("正确返回 agents 列表", async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          agents: {
            list: [
              { id: "main", default: true },
              { id: "work", name: "工作助手" },
            ],
          },
        }),
        "utf-8",
      );

      await writer.readConfig();
      const agents = writer.getAgentsList();
      expect(agents).toHaveLength(2);
      expect(agents[0].id).toBe("main");
      expect(agents[1].name).toBe("工作助手");
    });
  });

  // ----------------------------------------------------------
  // 写入 channels.rocketchat
  // ----------------------------------------------------------
  describe("setRocketchatChannel", () => {
    it("在空配置上正确写入", async () => {
      await writer.readConfig();
      writer.setRocketchatChannel("http://192.168.1.100:3000", 3000);
      await writer.save();

      // 重新读取验证
      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();
      expect(config.channels?.rocketchat?.enabled).toBe(true);
      expect(config.channels?.rocketchat?.serverUrl).toBe(
        "http://192.168.1.100:3000",
      );
      expect(config.channels?.rocketchat?.port).toBe(3000);
      expect(config.channels?.rocketchat?.dmPolicy).toBe("pairing");
    });

    it("不覆盖其他频道配置", async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          channels: {
            telegram: { enabled: true, token: "xxx" },
          },
        }),
        "utf-8",
      );

      await writer.readConfig();
      writer.setRocketchatChannel("http://localhost:3000", 3000);
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();
      expect((config.channels?.telegram as any)?.enabled).toBe(true);
      expect(config.channels?.rocketchat?.enabled).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 添加机器人
  // ----------------------------------------------------------
  describe("addBotAccount + addBinding", () => {
    it("正确添加机器人和 binding", async () => {
      await writer.readConfig();
      writer.setRocketchatChannel("http://localhost:3000", 3000);
      writer.addBotAccount("molty", "molty", "小龙虾");
      writer.addBinding("main", "molty");
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();

      expect(config.channels?.rocketchat?.accounts?.molty).toEqual({
        botUsername: "molty",
        botDisplayName: "小龙虾",
      });

      expect(config.bindings).toContainEqual({
        agentId: "main",
        match: { channel: "rocketchat", accountId: "molty" },
      });
    });

    it("不重复添加 binding", async () => {
      await writer.readConfig();
      writer.setRocketchatChannel("http://localhost:3000", 3000);
      writer.addBinding("main", "molty");
      writer.addBinding("main", "molty"); // 重复添加
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();

      const rcBindings = (config.bindings || []).filter(
        (b: any) =>
          b.match?.channel === "rocketchat" && b.match?.accountId === "molty",
      );
      expect(rcBindings).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // 添加群组
  // ----------------------------------------------------------
  describe("addGroup", () => {
    it("正确添加群组配置", async () => {
      await writer.readConfig();
      writer.setRocketchatChannel("http://localhost:3000", 3000);
      writer.addGroup("AI助手群", ["molty", "work-claw"], false);
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();

      expect(config.channels?.rocketchat?.groups?.["AI助手群"]).toEqual({
        requireMention: false,
        bots: ["molty", "work-claw"],
      });
    });
  });

  // ----------------------------------------------------------
  // 删除
  // ----------------------------------------------------------
  describe("removeRocketchatConfig", () => {
    it("正确清除 rocketchat 配置和 bindings", async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          channels: {
            rocketchat: { enabled: true, serverUrl: "http://localhost:3000" },
            telegram: { enabled: true },
          },
          bindings: [
            {
              agentId: "main",
              match: { channel: "rocketchat", accountId: "molty" },
            },
            {
              agentId: "main",
              match: { channel: "telegram", accountId: "bot1" },
            },
          ],
        }),
        "utf-8",
      );

      await writer.readConfig();
      writer.removeRocketchatConfig();
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();

      expect(config.channels?.rocketchat).toBeUndefined();
      expect((config.channels?.telegram as any)?.enabled).toBe(true);
      expect(config.bindings).toHaveLength(1);
      expect(config.bindings?.[0].match?.channel).toBe("telegram");
    });
  });

  // ----------------------------------------------------------
  // 移除机器人
  // ----------------------------------------------------------
  describe("removeBotAccount", () => {
    it("正确移除机器人及其 binding", async () => {
      await writer.readConfig();
      writer.setRocketchatChannel("http://localhost:3000", 3000);
      writer.addBotAccount("molty", "molty", "小龙虾");
      writer.addBotAccount("work", "work", "工作");
      writer.addBinding("main", "molty");
      writer.addBinding("work", "work");

      writer.removeBotAccount("molty");
      await writer.save();

      const writer2 = new ConfigWriter(configPath);
      const config = await writer2.readConfig();

      expect(config.channels?.rocketchat?.accounts?.molty).toBeUndefined();
      expect(config.channels?.rocketchat?.accounts?.work).toBeDefined();
      expect(config.bindings?.length).toBe(1);
      expect(config.bindings?.[0].match?.accountId).toBe("work");
    });
  });
});
