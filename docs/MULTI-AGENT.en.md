[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Config](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md)

# Multi-Agent Guide

## Overview

OpenClaw supports creating multiple Agents (AI brains), each with its own persona, model, workspace, and capabilities. With the `openclaw-rocketchat` plugin, you can bind different Rocket.Chat bots to different Agents to achieve:

- Separate **home assistant** and **work assistant** that don't interfere with each other
- Use **different AI models** for different scenarios (e.g., GPT for creative work, GLM for daily chat)
- Have **different groups** served by different Agents

---

## Core Concepts

### OpenClaw Routing Model

```
User message → Rocket.Chat → Plugin → Route matching → Agent
```

Routing rules are defined in `bindings`, with these matching fields:

| Field | Description |
|-------|-------------|
| `channel` | Channel type, always `"rocketchat"` |
| `accountId` | Bot account ID (key in `channels.rocketchat.accounts`) |

**Routing principle: one bot = one Agent.** Whichever bot receives the message determines which Agent processes it.

### Three-Layer Relationship

```
Agent (AI Brain)        Bot (Rocket.Chat User)          Group / DM
    │                          │                            │
    │  bindings                │  accounts config           │  groups config
    │                          │                            │
    ├── main ◄────────────── molty ◄──────────── DM / General Chat
    │                          │
    └── work ◄────────────── work-bot ◄────────── Work Discussion
```

---

## Option 1: Multi-Bot Routing (Recommended)

**One bot bound to one Agent, use multiple bots for multiple Agents.** This is the officially recommended approach — most stable and simplest.

### Step 1: Create Multiple Agents

```bash
# OpenClaw comes with a default 'main' Agent
# Create additional Agents
openclaw agents add work
openclaw agents add creative
```

Each Agent can have its own system prompt, model preferences, etc. under `~/.openclaw/agents/<name>/`.

### Step 2: Create a Bot for Each Agent

```bash
# Bot 1: Daily assistant, bound to main Agent
openclaw rocketchat add-bot
# Username: molty
# Display name: Crabby
# Bind to Agent: main

# Bot 2: Work assistant, bound to work Agent
openclaw rocketchat add-bot
# Username: work-bot
# Display name: Work Assistant
# Bind to Agent: work

# Bot 3: Writing assistant, bound to creative Agent
openclaw rocketchat add-bot
# Username: writer
# Display name: Writing Buddy
# Bind to Agent: creative
```

### Step 3: Create Groups as Needed

```bash
# Group 1: Daily chat with one bot
openclaw rocketchat add-group
# Channel name: Daily Chat
# Select bots: molty
# Require @mention: N (reply to all messages)

# Group 2: Work group with multiple bots
openclaw rocketchat add-group
# Channel name: Work Discussion
# Select bots: molty, work-bot
# Require @mention: Y (only reply when @mentioned, prevents crosstalk)
```

### Generated Configuration

After running the above commands, `openclaw.json` will contain:

```json5
{
  "channels": {
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",
      "port": 443,
      "accounts": {
        "molty": { "botUsername": "molty", "botDisplayName": "Crabby" },
        "work-bot": { "botUsername": "work-bot", "botDisplayName": "Work Assistant" },
        "writer": { "botUsername": "writer", "botDisplayName": "Writing Buddy" }
      },
      "groups": {
        "Daily Chat": { "requireMention": false, "bots": ["molty"] },
        "Work Discussion": { "requireMention": true, "bots": ["molty", "work-bot"] }
      }
    }
  },
  "bindings": [
    { "agentId": "main", "match": { "channel": "rocketchat", "accountId": "molty" } },
    { "agentId": "work", "match": { "channel": "rocketchat", "accountId": "work-bot" } },
    { "agentId": "creative", "match": { "channel": "rocketchat", "accountId": "writer" } }
  ]
}
```

### Usage

| Scenario | Action | Responding Agent |
|----------|--------|-----------------|
| DM Crabby | Send message directly | main |
| DM Work Assistant | Send message directly | work |
| DM Writing Buddy | Send message directly | creative |
| Post in "Daily Chat" | Send message | main (molty replies) |
| @Crabby in "Work Discussion" | `@molty review this proposal` | main |
| @Work Assistant in "Work Discussion" | `@work-bot summarize meeting notes` | work |

---

## Option 2: Per-Group Routing (Same Bot, Different Agent per Group)

**Not currently supported.** OpenClaw's bindings route by `channel` + `accountId` only, not by `group`. The same bot uses the same Agent across all groups.

**Workaround:** Create different bots for different groups, each bound to a different Agent. This is Option 1.

---

## Option 3: Multi-Agent in a Single Group

**Scenario:** Multiple Agent personas participating in the same group, e.g., a "Product Manager Agent" and "Tech Advisor Agent" each answering questions in one group.

### Direct Support (Recommended)

Add multiple bots to a group with `@mention` mode enabled:

```bash
openclaw rocketchat add-group
# Channel name: Project Discussion
# Select bots: molty, work-bot    (select multiple)
# Require @mention: Y              (must enable, otherwise all bots reply to every message)
```

Usage:
- `@molty analyze this feature from a user perspective` → main Agent replies
- `@work-bot assess technical feasibility` → work Agent replies
- Messages without @ → no bot replies (prevents crosstalk)

### Advanced: Orchestrator Pattern (Requires Custom Development)

If you need "one message auto-dispatched to multiple Agents" or "Agents conversing with each other," OpenClaw's native routing doesn't support this directly. You would need to:

1. Create an **Orchestrator Agent** bound to the group's bot
2. Define dispatch logic in the Orchestrator's system prompt or skills
3. The Orchestrator invokes other Agents via tools / skills / webhooks
4. Other Agents run in separate workspaces or separate OpenClaw instances

This is an advanced pattern beyond the plugin's scope and requires custom design.

---

## Option 4: Single-Bot Multi-Persona (Lightweight)

If you just want "one bot that can play multiple roles," you don't need multiple Agents. Define multiple personas in the Agent's system prompt:

```
You are a multi-functional assistant. Switch roles based on the user's prefix:
- "write: xxx" → professional writing assistant
- "code: xxx" → programming expert
- "translate: xxx" → translator
- Otherwise → general daily assistant
```

**Pros:** Simple setup, only one bot needed.
**Cons:** All roles share the same context and memory, no real isolation.

---

## Comparison

| Feature | Option 1: Multi-Bot | Option 3: Multi-Agent Group | Option 4: Multi-Persona |
|---------|:---:|:---:|:---:|
| Setup complexity | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Agent isolation | ✅ Full isolation | ✅ Full isolation | ❌ Shared context |
| Independent models | ✅ Each Agent can use different model | ✅ | ❌ |
| Independent memory | ✅ Each Agent has own workspace | ✅ | ❌ |
| Multi-role in group | Requires @mention | ✅ Natural support | Via prompt simulation |
| Native plugin support | ✅ Out of the box | ✅ Out of the box | ✅ Out of the box |
| Custom development needed | ❌ | ❌ (except Orchestrator) | ❌ |

---

## Practical Example: Home + Work Separation

### Goal

- **Home group**: Whole family uses it — daily Q&A, recipes, homework help
- **Work group**: Personal use only — code review, docs, meeting notes
- **DMs**: Chat with any assistant anytime

### Steps

```bash
# 1. Create Agents
openclaw agents add home    # Home assistant
openclaw agents add work    # Work assistant

# 2. Configure Agent system prompts (optional)
# Edit ~/.openclaw/agents/home/agent.md — set home assistant persona
# Edit ~/.openclaw/agents/work/agent.md — set work assistant persona

# 3. Create bots
openclaw rocketchat add-bot
# Username: home-bot, Display: Home Helper, Bind: home

openclaw rocketchat add-bot
# Username: work-bot, Display: Work Buddy, Bind: work

# 4. Create groups
openclaw rocketchat add-group
# Name: Our Home, Bot: home-bot, @mention: N

openclaw rocketchat add-group
# Name: Workspace, Bot: work-bot, @mention: N

# 5. Add family members to home group
openclaw rocketchat add-user
# Username: mom, Join: Our Home

openclaw rocketchat add-user
# Username: dad, Join: Our Home

# 6. Restart Gateway
openclaw gateway stop && openclaw gateway start
```

### Result

```
DM Home Helper    →  home Agent  →  Home-oriented AI
DM Work Buddy     →  work Agent  →  Work-oriented AI

"Our Home" group  →  home-bot auto-replies  →  Whole family can use
"Workspace" group →  work-bot auto-replies  →  Personal use only
```

---

## FAQ

### Q: Can one bot be bound to multiple Agents?

No. One bot (accountId) can only bind to one Agent. Create multiple bots if you need multiple Agents.

### Q: Can I change the binding?

Yes. Edit the `agentId` field in the `bindings` array in `~/.openclaw/openclaw.json`, then restart the Gateway:

```bash
openclaw gateway stop && openclaw gateway start
```

### Q: Will multiple bots in the same group all reply to every message?

If `requireMention` is `false`, yes. **Strongly recommended to enable @mention mode** (`requireMention: true`) for multi-bot groups, so only the @mentioned bot replies.

### Q: Is there a limit on the number of Agents?

OpenClaw doesn't limit Agent count. However, each Agent connects to an AI model, so too many Agents may increase API costs. 2-5 Agents is a reasonable range for practical use.

### Q: Can different Agents use different AI models?

Yes. Configure different models in each Agent's settings:

```bash
# Edit Agent configuration
vi ~/.openclaw/agents/work/agent.md
```

Or set a global default in `openclaw.json` under `agents.defaults.model` and override in individual Agent configs.
