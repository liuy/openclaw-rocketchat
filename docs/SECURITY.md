[首页](../README.md) · [使用指南](GUIDE.md) · [常见问题](FAQ.md) · [配置参数](CONFIGURATION.md) · [架构](ARCHITECTURE.md) · [安全](SECURITY.md) · [多 Agent](MULTI-AGENT.md)

# 🔒 安全模型与凭据管理

本文档介绍 openclaw-rocketchat 插件的安全设计、凭据生命周期和备份恢复机制。

---

## 目录

- [安全概览](#安全概览)
- [管理员密码安全](#管理员密码安全)
- [凭据存储架构](#凭据存储架构)
- [备份与恢复机制](#备份与恢复机制)
- [文件权限](#文件权限)
- [安全最佳实践](#安全最佳实践)

---

## 安全概览

```
安装 (install-rc.sh)              配置 (setup / add-bot)             运行时
┌──────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│ 生成 20 位随机密码     │     │ 弱密码检测 → 自动加固     │     │ WebSocket + TLS  │
│ ↓                    │     │ ↓                        │     │ authToken 认证    │
│ 通过环境变量传入 RC    │ ──→ │ 凭据存入安全目录 (0600)   │ ──→ │ 凭据不进入日志    │
│ ↓                    │     │ ↓                        │     │                  │
│ 保存到 .rc-info (0600)│     │ 同步备份到 .rc-credentials │     │                  │
│ ↓                    │     │                          │     │                  │
│ 关闭公开注册          │     │                          │     │                  │
└──────────────────────┘     └──────────────────────────┘     └──────────────────┘
```

## 管理员密码安全

### 新安装（v0.7.1+）

`install-rc.sh` 在安装时自动生成 20 位强随机密码：

```bash
# 密码生成逻辑（/dev/urandom + base64）
RC_ADMIN_PASS=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
```

密码通过 Docker 环境变量 `ADMIN_PASS` 传入 Rocket.Chat 容器，**从启动那一刻起就不存在弱口令窗口**。

同时自动开启：
- `Accounts_RegistrationForm: "Disabled"` — 禁止公开注册
- `Accounts_TwoFactorAuthentication_By_Email_Enabled: "false"` — 禁用邮箱二步验证（自建服务无邮件服务）

### 旧版安装升级

如果 Rocket.Chat 仍使用默认 `admin/admin`，`openclaw rocketchat setup` 会自动检测并执行加固：

1. 用 `admin/admin` 登录成功 → 确认为弱口令
2. 调用 RC API `users.update` 将密码改为 24 位强随机密码
3. 新密码保存到凭据文件和备份文件

```
setup 自动加固流程:
admin/admin 登录成功 → 生成强密码 → 调用 API 修改 → 保存凭据 → 关闭公开注册
```

## 凭据存储架构

所有凭据分布在两个位置，互为备份：

```
~/.openclaw/credentials/rocketchat/    ← 插件凭据目录（插件重装可能丢失）
├── admin.json                         ← 管理员 userId + authToken + password
├── bots.json                          ← 机器人 userId + password / authToken
└── users.json                         ← 用户列表 + 权限

~/rocketchat/                          ← RC 安装目录（插件重装不影响）
├── .rc-info                           ← 安装信息（服务器地址、域名、管理员凭据）
├── .rc-credentials                    ← 凭据完整备份（管理员、机器人、用户密码）
├── docker-compose.yml
├── nginx.conf
└── ssl/
```

| 文件 | 位置 | 用途 | 插件重装后 |
|------|------|------|-----------|
| `admin.json` | `~/.openclaw/credentials/` | 管理员登录 | ❌ 可能丢失 |
| `bots.json` | `~/.openclaw/credentials/` | 机器人连接 | ❌ 可能丢失 |
| `.rc-info` | `~/rocketchat/` | 安装信息 + setup 自动检测 | ✅ 保留 |
| `.rc-credentials` | `~/rocketchat/` | 全量凭据备份 | ✅ 保留 |

## 备份与恢复机制

### 自动备份

每当创建或更新凭据时，自动同步到 `~/rocketchat/.rc-credentials`：

- `saveAdminCredentials()` → 自动备份管理员凭据
- `saveBotCredentials()` → 自动备份机器人凭据
- `createPersonalAccount()` → 自动备份用户密码

### 冲突恢复（插件重装后）

插件重装后再次运行 `setup` 或 `add-bot`，如果用户/机器人在 RC 中已存在：

**用户名冲突恢复（3 级降级策略）：**

```
1. 从 .rc-credentials 读取备份密码 → 登录验证 → 恢复成功
   ↓ 失败
2. 用用户刚输入的密码尝试登录 → 匹配则恢复
   ↓ 失败
3. 用管理员权限调用 API 强制重置密码
```

**机器人名冲突恢复（2 级降级策略）：**

```
1. 从 .rc-credentials 读取备份密码 → 登录验证 → 恢复成功
   ↓ 失败
2. 用管理员权限调用 API 强制重置密码 → 保存新凭据
```

## 文件权限

| 文件 | 权限 | 说明 |
|------|------|------|
| `~/.openclaw/credentials/rocketchat/` | `0700` | 仅所有者可进入 |
| `admin.json` / `bots.json` / `users.json` | `0600` | 仅所有者可读写 |
| `~/rocketchat/.rc-info` | `0600` | 仅所有者可读写 |
| `~/rocketchat/.rc-credentials` | `0600` | 仅所有者可读写 |

> Windows 上不设置 Unix 权限，但文件位于用户主目录下，默认受 NTFS ACL 保护。

## 安全最佳实践

1. **不要分享 `.rc-info` 和 `.rc-credentials` 文件** — 它们包含明文密码
2. **不要将凭据目录加入 Git** — `~/.openclaw/credentials/` 应始终排除在版本控制外
3. **定期检查防火墙** — 确保只开放 443 和 80 端口
4. **HTTPS 是必须的** — `install-rc.sh` 自动配置 Let's Encrypt 证书，不要降级为 HTTP
5. **关注 RC 安全更新** — 定期 `docker pull` 获取最新的 Rocket.Chat 镜像
