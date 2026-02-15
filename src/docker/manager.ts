// ============================================================
// Docker 容器生命周期管理
// ============================================================

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { networkInterfaces } from "node:os";
import { createConnection } from "node:net";
import { generateComposeYaml, generateEnvFile } from "./compose.js";
import type { ContainerStatus } from "../rc-api/types.js";

const execFileAsync = promisify(execFile);

export class DockerManager {
  private composeDir: string;

  constructor(composeDir: string) {
    this.composeDir = composeDir;
  }

  // ----------------------------------------------------------
  // 环境检测
  // ----------------------------------------------------------

  /** 检查 Docker 是否已安装 */
  async isDockerInstalled(): Promise<{ installed: boolean; version?: string }> {
    try {
      const { stdout } = await execFileAsync("docker", ["--version"]);
      const match = stdout.match(/Docker version ([\d.]+)/);
      return { installed: true, version: match?.[1] };
    } catch {
      return { installed: false };
    }
  }

  /** 检查 Docker Compose 是否可用 */
  async isComposeInstalled(): Promise<{
    installed: boolean;
    version?: string;
  }> {
    try {
      const { stdout } = await execFileAsync("docker", [
        "compose",
        "version",
      ]);
      const match = stdout.match(/v?([\d.]+)/);
      return { installed: true, version: match?.[1] };
    } catch {
      return { installed: false };
    }
  }

  /** 检查端口是否可用 */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.setTimeout(1000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(false); // 端口被占用
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(true); // 连接超时 = 端口可用
      });
      socket.on("error", () => {
        resolve(true); // 连接失败 = 端口可用
      });
    });
  }

  // ----------------------------------------------------------
  // Compose 文件管理
  // ----------------------------------------------------------

  /** 生成 docker-compose.yml 和 .env 文件 */
  async generateComposeFile(port: number): Promise<void> {
    await mkdir(this.composeDir, { recursive: true });

    await writeFile(
      join(this.composeDir, "docker-compose.yml"),
      generateComposeYaml(port),
      "utf-8",
    );

    await writeFile(
      join(this.composeDir, ".env"),
      generateEnvFile(port),
      "utf-8",
    );
  }

  // ----------------------------------------------------------
  // 容器生命周期
  // ----------------------------------------------------------

  /** 启动容器 */
  async start(): Promise<void> {
    await this.compose(["up", "-d"]);
  }

  /** 停止容器 */
  async stop(): Promise<void> {
    await this.compose(["down"]);
  }

  /** 移除容器（可选删除卷） */
  async remove(deleteVolumes: boolean): Promise<void> {
    const args = ["down"];
    if (deleteVolumes) {
      args.push("-v");
    }
    await this.compose(args);
  }

  /** 获取容器状态 */
  async getStatus(): Promise<ContainerStatus> {
    try {
      const { stdout } = await this.compose(["ps", "--format", "json"]);
      const lines = stdout
        .trim()
        .split("\n")
        .filter((l) => l.startsWith("{"));

      let rcStatus: ContainerStatus["rocketchat"] = "not_found";
      let mongoStatus: ContainerStatus["mongodb"] = "not_found";
      let uptime: string | undefined;

      for (const line of lines) {
        try {
          const info = JSON.parse(line);
          const name = (info.Service || info.Name || "").toLowerCase();
          const state = (info.State || "").toLowerCase();

          if (name.includes("rocketchat")) {
            rcStatus = state === "running" ? "running" : "stopped";
            if (info.Status) {
              uptime = info.Status;
            }
          } else if (name.includes("mongo")) {
            mongoStatus = state === "running" ? "running" : "stopped";
          }
        } catch {
          // 跳过无法解析的行
        }
      }

      return { rocketchat: rcStatus, mongodb: mongoStatus, uptime };
    } catch {
      return { rocketchat: "not_found", mongodb: "not_found" };
    }
  }

  /** 等待 Rocket.Chat 就绪（轮询 /api/v1/info） */
  async waitForReady(
    port: number,
    timeoutMs = 120000,
    onProgress?: (msg: string) => void,
  ): Promise<void> {
    const start = Date.now();
    const url = `http://127.0.0.1:${port}/api/v1/info`;

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          return;
        }
      } catch {
        // 服务还没就绪，继续等待
      }

      const elapsed = Math.floor((Date.now() - start) / 1000);
      onProgress?.(`等待服务就绪... (${elapsed}s)`);
      await new Promise((r) => setTimeout(r, 3000));
    }

    throw new Error(
      `Rocket.Chat 启动超时（${Math.floor(timeoutMs / 1000)}秒），请检查 Docker 日志：docker compose -f "${join(this.composeDir, "docker-compose.yml")}" logs`,
    );
  }

  // ----------------------------------------------------------
  // 网络工具
  // ----------------------------------------------------------

  /**
   * 获取本机非 loopback IP 地址
   * 优先物理网卡（en0/eth0/wlan0），跳过 Docker/VPN 等虚拟接口
   */
  getHostIp(): string {
    const interfaces = networkInterfaces();

    // 应跳过的虚拟接口名称模式
    const skipPatterns = [
      /^docker/i,
      /^br-/,
      /^veth/,
      /^virbr/,
      /^vmnet/,
      /^vboxnet/,
      /^tailscale/i,
      /^utun/,      // macOS VPN
      /^tun/,
      /^tap/,
    ];

    // 优先的物理接口名称模式（macOS: en0/en1, Linux: eth0/wlan0/ens*）
    const preferredPatterns = [
      /^en\d+$/,    // macOS Ethernet/WiFi
      /^eth\d+$/,   // Linux Ethernet
      /^ens\d+$/,   // Linux systemd Ethernet
      /^enp\d+/,    // Linux PCI Ethernet
      /^wlan\d+$/,  // Linux WiFi
      /^wlp\d+/,    // Linux PCI WiFi
    ];

    let fallbackIp: string | null = null;

    // 第一遍：找优先接口
    for (const pattern of preferredPatterns) {
      for (const name of Object.keys(interfaces)) {
        if (!pattern.test(name)) continue;
        for (const iface of interfaces[name] || []) {
          if (iface.family === "IPv4" && !iface.internal) {
            return iface.address;
          }
        }
      }
    }

    // 第二遍：找任意非虚拟接口
    for (const name of Object.keys(interfaces)) {
      if (skipPatterns.some((p) => p.test(name))) continue;
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          if (!fallbackIp) fallbackIp = iface.address;
        }
      }
    }

    return fallbackIp || "127.0.0.1";
  }

  /** 检查 compose 文件是否存在 */
  composeFileExists(): boolean {
    return existsSync(join(this.composeDir, "docker-compose.yml"));
  }

  // ----------------------------------------------------------
  // 内部：执行 docker compose 命令
  // ----------------------------------------------------------

  private async compose(
    args: string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync("docker", ["compose", "-f", join(this.composeDir, "docker-compose.yml"), ...args], {
      cwd: this.composeDir,
      timeout: 300000, // 5 分钟超时（拉镜像可能很慢）
    });
  }
}
