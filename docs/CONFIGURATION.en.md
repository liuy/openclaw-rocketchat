[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Configuration](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md)

# Configuration Reference

All config is written automatically by CLI commands into `~/.openclaw/openclaw.json`. You normally don't need to edit it manually, but understanding the structure helps with troubleshooting and advanced customization.

## channels.rocketchat — Channel Config

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable/disable the Rocket.Chat channel |
| `serverUrl` | `string` | — | Rocket.Chat server URL, e.g. `"https://123-45-67-89.sslip.io"` or `"https://127.0.0.1"` (co-located) |
| `port` | `number` | `443` | Rocket.Chat HTTPS port (the port specified during `install-rc.sh` installation) |
| `dmPolicy` | `string` | `"pairing"` | DM policy. `"pairing"` means setup auto-creates DM channels between users and bots |
| `accounts` | `object` | `{}` | Bot accounts. Key is the bot ID (written by `add-bot` command) |
| `accounts.<id>.botUsername` | `string` | — | Bot's username in Rocket.Chat |
| `accounts.<id>.botDisplayName` | `string` | — | Bot's display name (supports Unicode) |
| `groups` | `object` | `{}` | Group config (written by `add-group` command). Key is the group name |
| `groups.<name>.bots` | `string[]` | — | Bots in this group (matching keys in `accounts`) |
| `groups.<name>.requireMention` | `boolean` | `false` | Whether bot requires `@mention` to respond. `false`: responds to all messages; `true`: only responds when directly `@mentioned` (recommended for multi-bot groups to avoid all bots replying at once) |

> **Broadcast mentions**: `@here`, `@all`, `@everyone` never trigger bot responses, even when `requireMention` is `false`. Only direct `@botname` mentions trigger a response.

## bindings — Agent Bindings

The `bindings` array maps bot accounts to Agents (written by `add-bot` command):

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | `string` | The Agent ID to bind to (e.g. `"main"`). Created via `openclaw agents add` |
| `match.channel` | `string` | Always `"rocketchat"` |
| `match.accountId` | `string` | Matches a key in `channels.rocketchat.accounts` |

## plugins — Plugin Config

| Parameter | Type | Description |
|-----------|------|-------------|
| `entries.openclaw-rocketchat.enabled` | `boolean` | Whether the plugin is enabled. Gateway auto-detects and sets to `true` on start |
| `installs.openclaw-rocketchat.source` | `string` | Installation source, typically `"npm"` |
| `installs.openclaw-rocketchat.spec` | `string` | Installed package spec, e.g. `"openclaw-rocketchat@0.5.0"` |
| `installs.openclaw-rocketchat.installPath` | `string` | Plugin installation path, e.g. `"~/.openclaw/extensions/openclaw-rocketchat"` |
| `installs.openclaw-rocketchat.version` | `string` | Currently installed version |
| `installs.openclaw-rocketchat.installedAt` | `string` | Installation timestamp (ISO format) |

## Full Config Example

Below shows the Rocket.Chat plugin-related sections of `~/.openclaw/openclaw.json` (omitting `meta`, `auth`, `models`, `agents`, `gateway`, and other unrelated sections):

```json5
{
  // Rocket.Chat channel config (written by setup / add-bot / add-group)
  "channels": {
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",     // Use 127.0.0.1 for co-located; use sslip.io domain for remote
      "port": 443,                            // Rocket.Chat HTTPS port
      "dmPolicy": "pairing",                  // DM policy
      "accounts": {
        "molty": {                            // Bot 1
          "botUsername": "molty",
          "botDisplayName": "Lobster"
        },
        "work-bot": {                         // Bot 2 (optional, multiple bots)
          "botUsername": "work-bot",
          "botDisplayName": "Work Helper"
        }
      },
      "groups": {                             // Groups (optional)
        "AI Squad": {
          "requireMention": false,            // Responds to all messages
          "bots": ["molty", "work-bot"]       // Bots in this group
        },
        "Tech Talk": {
          "requireMention": true,             // Only responds when @mentioned
          "bots": ["molty"]
        }
      }
    }
  },

  // Bot → Agent bindings (written by add-bot)
  "bindings": [
    {
      "agentId": "main",                      // Bound to main Agent
      "match": {
        "channel": "rocketchat",
        "accountId": "molty"                   // Matches key in accounts
      }
    },
    {
      "agentId": "work",                      // Different bots can bind to different Agents
      "match": {
        "channel": "rocketchat",
        "accountId": "work-bot"
      }
    }
  ],

  // Plugin state
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

## Manual Editing

If auto-configuration has issues, edit `~/.openclaw/openclaw.json` directly:

```bash
# Edit config
vi ~/.openclaw/openclaw.json

# Restart Gateway to apply changes
openclaw gateway restart
```

**Common manual edits:**

- **Change server URL**: Edit `channels.rocketchat.serverUrl` (`https://127.0.0.1` for co-located, `https://IP.sslip.io` for remote)
- **Change port**: Edit `channels.rocketchat.port`
- **Disable/enable channel**: Set `channels.rocketchat.enabled` to `false` / `true`
- **Rebind bot to different Agent**: Edit `bindings` array, change `agentId`
- **Remove a bot**: Delete entries from both `accounts` and `bindings`
- **Toggle @mention requirement**: Edit `groups.<name>.requireMention`
- **Upgrade plugin version**: Use `openclaw rocketchat upgrade` (auto backup config, install new version, restore config)

> **Note**: Bot credentials (passwords, tokens) are stored in two locations:
> - `~/.openclaw/credentials/rocketchat/` — used at runtime (may be lost on plugin reinstall)
> - `~/rocketchat/.rc-credentials` — automatic backup (auto-restored after reinstall)
>
> For detailed credential management and security info, see [Security & Credentials](SECURITY.en.md).

## Full Reset

To completely remove Rocket.Chat config and start over:

> **Tip**: If you just want to upgrade the plugin version, you don't need a full reset. Use `openclaw rocketchat upgrade` instead.

```bash
# 1. Clean all Rocket.Chat related config entries (must run BEFORE stopping Gateway, otherwise Gateway may fail to stop due to config issues)
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

# 2. Stop Gateway
openclaw gateway stop

# 3. (Optional) To also reset Rocket.Chat data:
# cd ~/rocketchat && docker compose down -v

# 4. Remove plugin and credentials
rm -rf ~/.openclaw/extensions/openclaw-rocketchat
rm -rf ~/.openclaw/credentials/rocketchat*

# 4b. (Optional) Also clean install backups (if you also reset RC in step 3)
# rm -f ~/rocketchat/.rc-info ~/rocketchat/.rc-credentials

# 5. Reinstall (if you reset RC in step 3, run install-rc.sh first)
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
openclaw rocketchat add-bot
openclaw gateway start
```
