// ============================================================
// REST API 客户端测试
// 使用 mock fetch 测试请求封装
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RocketChatRestClient } from "../src/rc-api/rest-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("RocketChatRestClient", () => {
  let client: RocketChatRestClient;

  beforeEach(() => {
    client = new RocketChatRestClient("http://localhost:3000");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  // 认证
  // ----------------------------------------------------------
  describe("login", () => {
    it("应该成功登录并返回 authToken", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          data: { userId: "user123", authToken: "token456" },
        }),
      });

      const result = await client.login("admin", "password");

      expect(result).toEqual({
        userId: "user123",
        authToken: "token456",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ user: "admin", password: "password" }),
        }),
      );
    });

    it("登录后请求应携带认证头", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: { userId: "u1", authToken: "t1" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            info: { version: "7.0.0" },
            success: true,
          }),
        });

      await client.login("admin", "pass");
      await client.serverInfo();

      const secondCall = mockFetch.mock.calls[1];
      const headers = secondCall[1].headers;
      expect(headers["X-Auth-Token"]).toBe("t1");
      expect(headers["X-User-Id"]).toBe("u1");
    });
  });

  // ----------------------------------------------------------
  // 用户管理
  // ----------------------------------------------------------
  describe("createUser", () => {
    it("应该创建用户并返回用户信息", async () => {
      // 先设置认证
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            _id: "new-user-id",
            username: "testuser",
            name: "Test User",
          },
          success: true,
        }),
      });

      const user = await client.createUser({
        name: "Test User",
        email: "test@test.com",
        password: "password123",
        username: "testuser",
        roles: ["user"],
      });

      expect(user._id).toBe("new-user-id");
      expect(user.username).toBe("testuser");
    });
  });

  describe("getUserInfo", () => {
    it("用户存在时返回用户信息", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { _id: "u1", username: "alice" },
          success: true,
        }),
      });

      const user = await client.getUserInfo("alice");
      expect(user?.username).toBe("alice");
    });

    it("用户不存在时返回 null", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: "User not found",
        }),
      });

      const user = await client.getUserInfo("nobody");
      expect(user).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // DM
  // ----------------------------------------------------------
  describe("createDirectMessage", () => {
    it("应该创建 DM 并返回房间", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          room: { _id: "dm-room-1", t: "d", usernames: ["alice", "bot"] },
          success: true,
        }),
      });

      const room = await client.createDirectMessage(["alice", "bot"]);
      expect(room._id).toBe("dm-room-1");
      expect(room.t).toBe("d");
    });
  });

  // ----------------------------------------------------------
  // 群组
  // ----------------------------------------------------------
  describe("createGroup", () => {
    it("应该创建私有频道", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          group: { _id: "group-1", name: "test-group", t: "p" },
          success: true,
        }),
      });

      const group = await client.createGroup("test-group", [
        "alice",
        "bot",
      ]);
      expect(group._id).toBe("group-1");
      expect(group.name).toBe("test-group");
    });
  });

  // ----------------------------------------------------------
  // 消息
  // ----------------------------------------------------------
  describe("sendMessage", () => {
    it("应该发送消息到指定房间", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: { _id: "msg-1", rid: "room-1", msg: "hello" },
          success: true,
        }),
      });

      const msg = await client.sendMessage("room-1", "hello");
      expect(msg._id).toBe("msg-1");
      expect(msg.msg).toBe("hello");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.message.rid).toBe("room-1");
      expect(body.message.msg).toBe("hello");
    });
  });

  // ----------------------------------------------------------
  // 服务器信息
  // ----------------------------------------------------------
  describe("serverInfo", () => {
    it("应该返回服务器版本", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          info: { version: "7.2.0" },
          success: true,
        }),
      });

      const info = await client.serverInfo();
      expect(info.version).toBe("7.2.0");
      expect(info.success).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 错误处理
  // ----------------------------------------------------------
  describe("错误处理", () => {
    it("API 返回错误时应抛出异常", async () => {
      client.setAuth("admin-id", "admin-token");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "Invalid params",
        }),
      });

      await expect(
        client.createUser({
          name: "test",
          email: "test@test.com",
          password: "pass",
          username: "test",
        }),
      ).rejects.toThrow("Rocket.Chat API error");
    });

    it("HTTP 429 应自动重试", async () => {
      client.setAuth("admin-id", "admin-token");

      // 第一次返回 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([["Retry-After", "1"]]),
        json: async () => ({}),
      });

      // 第二次成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          info: { version: "7.0.0" },
          success: true,
        }),
      });

      const info = await client.serverInfo();
      expect(info.version).toBe("7.0.0");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
