[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Config](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md) · [Multi-Channel](MULTI-CHANNEL.en.md)

# Multi-Channel Coexistence Guide

## Why Run Multiple Channels?

You may already be chatting with OpenClaw via Telegram or another platform. After installing the `openclaw-rocketchat` plugin, **you don't have to give up your existing channels** — they work simultaneously without interference.

This means:
- **Your existing Telegram / Slack / WhatsApp configuration remains untouched**
- **The same Agent can respond on multiple platforms at the same time**
- You can try Rocket.Chat first, then decide on your long-term setup

> **Who is this for?** Users who already have Telegram/Slack configured and want to also try Rocket.Chat.
> If you're starting fresh, go directly to the [Guide](GUIDE.en.md).

---

## How It Works

OpenClaw's Gateway natively supports connecting to multiple messaging platforms simultaneously. Each platform is an independent `channel` in the configuration, fully isolated:

```
                    ┌─ channels.telegram ─── Telegram Bot
                    │
OpenClaw Gateway ───┼─ channels.rocketchat ─ Rocket.Chat (this plugin)
                    │
                    └─ channels.slack ────── Slack Bot
```

**Routing rules:**
- Replies go back to the platform where the message originated
- The AI model doesn't "choose" a platform — routing is entirely config-driven
- Each message is matched to an Agent via `bindings` rules

---

## Tutorial: Telegram + Rocket.Chat Side by Side

The most common scenario — you're already using Telegram and want to add Rocket.Chat for family or team use.

### Prerequisites

- OpenClaw installed and running
- Telegram Bot already configured (`channels.telegram` working)
- A server with a public IP (for deploying Rocket.Chat)

### Step 1: Install Rocket.Chat + Plugin

```bash
# One-click install Rocket.Chat on your server
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash

# Install the plugin
openclaw plugins install openclaw-rocketchat

# Run the setup wizard
openclaw rocketchat setup
```

**The setup wizard won't touch your existing Telegram config.** It only writes to the `channels.rocketchat` section.

### Step 2: Add a Bot

```bash
openclaw rocketchat add-bot
# Username: molty
# Display name: Crabby
# Bind to Agent: main   ← same Agent as Telegram
```

### Step 3: Restart the Gateway

```bash
openclaw gateway stop && openclaw gateway start
```

**Done.** Your OpenClaw now works on both Telegram and Rocket.Chat simultaneously.

### Final Configuration

Your `openclaw.json` will contain both channels:

```json5
{
  "channels": {
    // Telegram channel (your existing config, unchanged)
    "telegram": {
      "enabled": true,
      "botToken": "123:your_telegram_bot_token",
      "dmPolicy": "pairing",
      "groups": {
        "*": { "requireMention": true }
      }
    },

    // Rocket.Chat channel (newly added)
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",
      "port": 443,
      "dmPolicy": "pairing",
      "accounts": {
        "molty": {
          "botUsername": "molty",
          "botDisplayName": "Crabby"
        }
      }
    }
  },

  // Routing rules (two bindings, same Agent)
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "telegram" }
    },
    {
      "agentId": "main",
      "match": { "channel": "rocketchat", "accountId": "molty" }
    }
  ]
}
```

### Message Flow

```
You on Telegram → telegram channel → main Agent → reply on Telegram
Family on Rocket.Chat → rocketchat channel → main Agent → reply on Rocket.Chat
```

Both sides have independent conversations. Same Agent, but each platform's chat context is isolated.

---

## Advanced: Different Agents for Different Platforms

If you want Telegram and Rocket.Chat to be served by different AI "personalities":

### Create an Additional Agent

```bash
openclaw agents add home    # Home assistant for Rocket.Chat
```

### Bind the Bot to the New Agent

```bash
openclaw rocketchat add-bot
# Username: home-bot
# Display name: Home Helper
# Bind to Agent: home   ← choose a different Agent
```

### Result

```json5
{
  "bindings": [
    // Telegram → main Agent (your personal assistant)
    {
      "agentId": "main",
      "match": { "channel": "telegram" }
    },
    // Rocket.Chat → home Agent (family assistant)
    {
      "agentId": "home",
      "match": { "channel": "rocketchat", "accountId": "home-bot" }
    }
  ]
}
```

| Platform | Agent | Users | Model |
|----------|-------|-------|-------|
| Telegram | main | You | Claude / GPT (your existing setup) |
| Rocket.Chat | home | Family | GLM / any model |

> **More multi-Agent patterns** in the [Multi-Agent Guide](MULTI-AGENT.en.md).

---

## Other Channel Combinations

The same approach works for any combination of OpenClaw-supported channels:

### Slack + Rocket.Chat

```json5
{
  "channels": {
    "slack": {
      "enabled": true,
      "mode": "socket",
      "appToken": "xapp-...",
      "botToken": "xoxb-..."
    },
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",
      "port": 443,
      // ...
    }
  }
}
```

### WhatsApp + Rocket.Chat

```json5
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "personal": {}
      }
    },
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",
      "port": 443,
      // ...
    }
  }
}
```

### Three Channels at Once

```json5
{
  "channels": {
    "telegram": { "enabled": true, /* ... */ },
    "slack": { "enabled": true, /* ... */ },
    "rocketchat": { "enabled": true, /* ... */ }
  },
  "bindings": [
    { "agentId": "main", "match": { "channel": "telegram" } },
    { "agentId": "work", "match": { "channel": "slack", "teamId": "T123456789" } },
    { "agentId": "home", "match": { "channel": "rocketchat", "accountId": "molty" } }
  ]
}
```

---

## Why Add Rocket.Chat?

When running multiple channels, Rocket.Chat offers unique advantages:

| Feature | Telegram | Slack | Rocket.Chat |
|---------|:---:|:---:|:---:|
| Works in mainland China | ❌ Needs VPN | ✅ | ✅ |
| Full data sovereignty | ❌ Via TG servers | ❌ Via Slack servers | ✅ Local storage |
| Share with team/family | ❌ Individual accounts | Enterprise only | ✅ Out of the box |
| Read-only access (audit) | ❌ | Limited | ✅ Native support |
| Multi-bot groups + @mention | ✅ | ✅ | ✅ |
| Dedicated push notifications | ❌ Mixed with social | ❌ Mixed with work | ✅ Dedicated App |
| Free self-hosted | ❌ | ❌ | ✅ |

**Typical migration path:**

1. Keep Telegram as-is, add Rocket.Chat alongside
2. Invite family/colleagues to Rocket.Chat (no VPN, no third-party sign-up needed)
3. After trying both, decide on your long-term solution

---

## Architecture: Multi-Channel

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  📱 Telegram   │  │  💬 Slack      │  │  🚀 Rocket.Chat│
│  (personal)    │  │  (work team)   │  │  (family/team) │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                    │
        │ Bot API           │ Socket Mode        │ REST + DDP
        │                   │                    │
┌───────▼───────────────────▼────────────────────▼────────┐
│                    OpenClaw Gateway                       │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ telegram     │ │ slack        │ │ rocketchat        │ │
│  │ channel      │ │ channel      │ │ channel (plugin)  │ │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
│         │                │                   │           │
│         ▼                ▼                   ▼           │
│  ┌──────────────────────────────────────────────────┐   │
│  │              bindings (routing rules)              │   │
│  └──────┬──────────────┬─────────────────┬──────────┘   │
│         ▼              ▼                 ▼               │
│  ┌──────────┐   ┌──────────┐      ┌──────────┐         │
│  │  Agent:  │   │  Agent:  │      │  Agent:  │         │
│  │  main    │   │  work    │      │  home    │         │
│  └──────────┘   └──────────┘      └──────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## FAQ

### Q: Will installing the Rocket.Chat plugin affect my existing Telegram setup?

No. `openclaw rocketchat setup` only writes to `channels.rocketchat`. It does not modify `channels.telegram` or any other channel configuration.

### Q: If the same Agent serves two platforms, will context leak between them?

No. Each platform's conversations (DM / group) have independent sessions with fully isolated context. Telegram chats won't appear in Rocket.Chat conversations.

### Q: Can I try Rocket.Chat and uninstall if I don't like it?

Yes. Run `openclaw rocketchat uninstall` to completely remove it without affecting other channels.

### Q: Does running multiple channels increase resource usage?

The Gateway itself is lightweight. The main cost is AI model API calls, which depend on message volume, not channel count. Rocket.Chat containers need an additional ~512MB-1GB of RAM.

### Q: Can different channels use different AI models?

Yes. Create different Agents and bind them to different channels. Each Agent can have its own model. For example, Telegram with Claude, Rocket.Chat with GLM. See the [Multi-Agent Guide](MULTI-AGENT.en.md).

### Q: Will upgrading the Rocket.Chat plugin affect Telegram?

No. `openclaw rocketchat upgrade` only updates this plugin. The Gateway briefly restarts during upgrade (usually a few seconds), after which all channels resume.
