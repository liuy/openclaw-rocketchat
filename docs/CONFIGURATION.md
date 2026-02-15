[首页](../README.md) · [使用指南](GUIDE.md) · [常见问题](FAQ.md) · [配置参数](CONFIGURATION.md) · [架构](ARCHITECTURE.md) · [安全](SECURITY.md) · [多 Agent](MULTI-AGENT.md) · [多渠道](MULTI-CHANNEL.md) · [命令](COMMANDS.md)

# 配置参数详解

所有配置由 CLI 命令自动写入 `~/.openclaw/openclaw.json`。通常你不需要手动编辑，但了解配置结构有助于排查问题和高级自定义。

## channels.rocketchat — 频道配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Rocket.Chat 频道 |
| `serverUrl` | `string` | — | Rocket.Chat 服务器地址，如 `"https://123-45-67-89.sslip.io"` 或 `"https://127.0.0.1"`（同机部署） |
| `port` | `number` | `443` | Rocket.Chat 对外 HTTPS 端口（`install-rc.sh` 安装时指定的端口） |
| `dmPolicy` | `string` | `"pairing"` | 私聊策略。`"pairing"` 表示 setup 时自动为用户和机器人创建 DM 通道 |
| `accounts` | `object` | `{}` | 机器人账号列表，key 为机器人 ID（由 `add-bot` 命令自动写入） |
| `accounts.<id>.botUsername` | `string` | — | 机器人在 Rocket.Chat 中的用户名 |
| `accounts.<id>.botDisplayName` | `string` | — | 机器人显示昵称（可中文） |
| `groups` | `object` | `{}` | 群组配置（由 `add-group` 命令自动写入），key 为群组名 |
| `groups.<name>.bots` | `string[]` | — | 群组中的机器人列表（对应 `accounts` 的 key） |
| `groups.<name>.requireMention` | `boolean` | `false` | 群内是否需要 `@机器人名` 才回复。`false`：所有消息都回复；`true`：只有 `@机器人` 才回复（多机器人群推荐开启，避免抢答） |

> **关于群内广播提及**：`@here`、`@all`、`@everyone` 这类广播提及不会触发机器人回复，即使 `requireMention` 为 `false`。只有直接 `@机器人名` 才会触发。

## bindings — Agent 绑定

`bindings` 数组将机器人账号绑定到 Agent（由 `add-bot` 命令自动写入）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `agentId` | `string` | 绑定的 Agent ID（如 `"main"`）。通过 `openclaw agents add` 创建 |
| `match.channel` | `string` | 固定为 `"rocketchat"` |
| `match.accountId` | `string` | 对应 `channels.rocketchat.accounts` 中的 key |

## plugins — 插件配置

| 参数 | 类型 | 说明 |
|------|------|------|
| `entries.openclaw-rocketchat.enabled` | `boolean` | 插件是否启用。Gateway 启动时自动检测并设为 `true` |
| `installs.openclaw-rocketchat.source` | `string` | 安装来源，通常为 `"npm"` |
| `installs.openclaw-rocketchat.spec` | `string` | 安装的包版本，如 `"openclaw-rocketchat@0.5.0"` |
| `installs.openclaw-rocketchat.installPath` | `string` | 插件安装路径，如 `"~/.openclaw/extensions/openclaw-rocketchat"` |
| `installs.openclaw-rocketchat.version` | `string` | 当前安装版本号 |
| `installs.openclaw-rocketchat.installedAt` | `string` | 安装时间（ISO 格式） |

## 完整配置示例

以下展示 `~/.openclaw/openclaw.json` 中与 Rocket.Chat 插件相关的配置（省略了 `meta`、`auth`、`models`、`agents`、`gateway` 等与插件无关的部分）：

```json5
{
  // Rocket.Chat 频道配置（由 setup / add-bot / add-group 自动写入）
  "channels": {
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",     // 同机部署用 127.0.0.1；远程部署填 sslip.io 域名
      "port": 443,                            // Rocket.Chat HTTPS 端口
      "dmPolicy": "pairing",                  // 私聊策略
      "accounts": {
        "molty": {                            // 机器人 1
          "botUsername": "molty",
          "botDisplayName": "小龙虾"
        },
        "work-bot": {                         // 机器人 2（可选，多个机器人）
          "botUsername": "work-bot",
          "botDisplayName": "工作助手"
        }
      },
      "groups": {                             // 群组（可选）
        "AI全能群": {
          "requireMention": false,            // 所有消息都回复
          "bots": ["molty", "work-bot"]       // 群内的机器人
        },
        "技术讨论": {
          "requireMention": true,             // 只有 @机器人 才回复
          "bots": ["molty"]
        }
      }
    }
  },

  // 机器人 → Agent 绑定（由 add-bot 自动写入）
  "bindings": [
    {
      "agentId": "main",                      // 绑定到 main Agent
      "match": {
        "channel": "rocketchat",
        "accountId": "molty"                   // 对应 accounts 中的 key
      }
    },
    {
      "agentId": "work",                      // 不同机器人可绑定不同 Agent
      "match": {
        "channel": "rocketchat",
        "accountId": "work-bot"
      }
    }
  ],

  // 插件状态
  "plugins": {
    "entries": {
      "openclaw-rocketchat": { "enabled": true }
    },
    "installs": {
      "openclaw-rocketchat": {
        "source": "npm",
        "spec": "openclaw-rocketchat@0.7.2",
        "installPath": "/root/.openclaw/extensions/openclaw-rocketchat",
        "version": "0.7.2",
        "installedAt": "2026-02-15T07:37:17.498Z"
      }
    }
  }
}
```

## 手动修改配置

如果自动配置出现问题，可以直接编辑 `~/.openclaw/openclaw.json`：

```bash
# 编辑配置
vi ~/.openclaw/openclaw.json

# 修改后重启 Gateway 生效
openclaw gateway restart
```

**常见手动修改场景：**

- **更换服务器地址**：修改 `channels.rocketchat.serverUrl`（同机部署填 `https://127.0.0.1`，远程部署填 `https://IP.sslip.io`）
- **更换端口**：修改 `channels.rocketchat.port`
- **禁用/启用频道**：修改 `channels.rocketchat.enabled` 为 `false` / `true`
- **修改机器人绑定的 Agent**：修改 `bindings` 数组中对应条目的 `agentId`
- **删除机器人**：从 `accounts` 和 `bindings` 中删除对应条目
- **修改群组的 @提及 规则**：修改 `groups.<name>.requireMention`
- **升级插件版本**：推荐使用 `openclaw rocketchat upgrade`（自动备份配置、安装新版、恢复配置）

> **注意**: 机器人的凭据（密码、token）存储在两个位置：
> - `~/.openclaw/credentials/rocketchat/` — 插件运行时使用（插件重装可能丢失）
> - `~/rocketchat/.rc-credentials` — 自动备份（插件重装后自动恢复）
>
> 详细的凭据管理和安全说明请参阅 [安全与凭据](SECURITY.md)。

## 完全重置 Rocket.Chat 配置

如果需要从头开始，运行以下命令清除所有 Rocket.Chat 相关配置：

> **提示**：如果只是想升级插件版本，不需要完全重置。请使用 `openclaw rocketchat upgrade`。

```bash
# 1. 清理配置文件中的所有 Rocket.Chat 相关条目（必须在停止 Gateway 之前执行，否则 Gateway 可能因配置异常无法正常停止）
python3 -c "
import json
p = '$HOME/.openclaw/openclaw.json'
with open(p) as f:
    c = json.load(f)
c.get('channels', {}).pop('rocketchat', None)
c['bindings'] = [b for b in c.get('bindings', []) if b.get('match', {}).get('channel') != 'rocketchat']
c.get('plugins', {}).get('entries', {}).pop('openclaw-rocketchat', None)
c.get('plugins', {}).get('entries', {}).pop('rocketchat', None)
c.get('plugins', {}).get('installs', {}).pop('openclaw-rocketchat', None)
with open(p, 'w') as f:
    json.dump(c, f, indent=2, ensure_ascii=False)
print('Done')
"

# 2. 停止 Gateway
openclaw gateway stop

# 3.（可选）如果也想重置 Rocket.Chat 数据（彻底删除容器、数据和安装目录）：
# cd ~/rocketchat && docker compose down -v && cd ~ && rm -rf ~/rocketchat

# 4. 清除插件和凭据
rm -rf ~/.openclaw/extensions/openclaw-rocketchat
rm -rf ~/.openclaw/credentials/rocketchat*

# 5. 重新安装（如果第 3 步重置了 RC，先重新跑 install-rc.sh）
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
openclaw rocketchat add-bot
openclaw gateway start
```
