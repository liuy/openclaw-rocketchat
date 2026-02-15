<div align="center">

# 🦞 openclaw-rocketchat

**The Missing Channel for OpenClaw Users in China**

[![npm version](https://img.shields.io/npm/v/openclaw-rocketchat?color=red)](https://www.npmjs.com/package/openclaw-rocketchat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-Kxiandaoyan%2Fopenclaw--rocketchat-blue?logo=github)](https://github.com/Kxiandaoyan/openclaw-rocketchat)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

[中文](./README.md) | **English**

---

**Chat with your OpenClaw AI via Rocket.Chat App**
**Dedicated Space · Dedicated Notifications · Self-Hosted · No VPN Required**

</div>

---

## The Problem

OpenClaw supports Telegram, WhatsApp, Discord, and 10+ other messaging platforms. Users worldwide can chat with their AI assistants through their favorite apps.

**But what about users in mainland China?**

- Telegram — blocked by the Great Firewall
- WhatsApp — requires a foreign phone number
- Discord — completely inaccessible
- Feishu (Lark) — complex setup, requires enterprise account

And there's a deeper problem: **even if these platforms work, your AI conversations get buried in social noise** — friend messages, group chats, channel updates. Important AI responses disappear in the flood.

## The Solution

> **What is Rocket.Chat?** [Rocket.Chat](https://www.rocket.chat/) is the world's largest open-source enterprise messaging platform, used by 12M+ users globally. Think of it as a self-hosted Slack/Teams you can run on your own server — polished UI, full-featured, multi-platform (phone/desktop/web), and downloadable from China's App Store.

This plugin connects OpenClaw to **Rocket.Chat**.

One command to deploy. Three steps to start chatting. Two deployment modes:

**Mode A: Co-located (Recommended)**

```
Your Phone (Rocket.Chat App)
       ↓ Direct IP Connection
Your Machine (Rocket.Chat + OpenClaw)
       ↓ localhost
AI Brain (OpenClaw Agent)
```

**Mode B: Split Deployment (Home network / Low-spec server friendly)**

```
Your Phone (Rocket.Chat App)
       ↓ Public IP
Cloud VPS (Rocket.Chat + MongoDB only)
       ↑ Plugin connects via public network
Home / Local (OpenClaw + this plugin)
       ↓ localhost
AI Brain (OpenClaw Agent)
```

> Mode B is great for: OpenClaw on home LAN without public IP, low-memory servers, or companies with existing RC instances.
> Install RC on remote VPS with one command: `curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash`

**Either way, your AI data never passes through third parties.**

## Ten Advantages

### 1. 🏠 A Dedicated AI Workspace

Using Telegram for AI chat? Your AI conversations are sandwiched between friend messages, group spam, and channel noise. Important AI replies get lost.

**Rocket.Chat becomes your dedicated AI command center.** Open it, and all you see are your AI assistants — no social distractions, no unrelated messages. One app, one purpose.

### 2. 🔔 Dedicated Push Notifications

When OpenClaw sends you a message, you get a notification from **Rocket.Chat** — not Telegram's 99th unread, not WeChat's 200th group message.

**You never miss an important AI response.**

### 3. 🔐 Complete Data Sovereignty

| Using Telegram | Using This Plugin |
|---|---|
| Messages go through Telegram's servers | Messages stay on your machine |
| Chat history stored on someone else's cloud | Chat history in your own MongoDB |
| You can't control where data goes | Docker volume is yours — delete anytime |
| Terms of service change without notice | You are the terms of service |

**Zero trust in third parties. Your AI conversations, private data, and work content stay on your own hard drive.**

### 4. 🇨🇳 Works Perfectly in Mainland China

- Rocket.Chat App is **directly downloadable** from China App Store / Google Play
- Server runs on your own machine — **no cross-border traffic**
- Auto **sslip.io free domain** + auto **Let's Encrypt HTTPS cert** — no domain purchase, no ICP registration needed
- Zero dependency on blocked services

### 5. ⚡ One-Command Deployment, Two Modes

No 10-page documentation to read. No browser-based admin panels to click through. No manual JSON editing.

```bash
openclaw rocketchat setup
```

An interactive wizard guides you through everything — Docker deployment, account creation, config writing — all in one go.

Choose the deployment mode that fits your situation:

| | Co-located | Split Deployment |
|---|---|---|
| **Who it's for** | Users with a public server | Home network, low-spec servers |
| **RC runs on** | Same machine as OpenClaw | Separate cloud VPS |
| **How to install** | `install-rc.sh` + `openclaw rocketchat setup` | `install-rc.sh` on VPS, connect locally |
| **Advantage** | Simplest, one machine | OpenClaw can run at home, RC in the cloud |

> Split deployment means even if your OpenClaw is on a **home LAN without a public IP**, a cheap VPS (1 core, 1 GB RAM is enough) lets your phone connect from anywhere.

### 6. 🤖 Multi-Agent, Multi-Bot

Create multiple Agents in OpenClaw (e.g., "Personal Assistant", "Work Helper", "Code Reviewer"), each appearing as a separate bot in Rocket.Chat:

```
Conversation List
  🦞 Lobster          ← DM: Personal assistant
  💼 Work Helper      ← DM: Work agent
  🏠 AI Squad         ← Group: All bots together
  📝 Code Review      ← Group: Dedicated code agent
```

**DMs and group chats coexist** — ask simple questions via DM, tackle complex problems in groups with multiple bots collaborating.

### 7. 👥 Team Collaboration — Share AI Across Your Whole Team

This isn't just a single-user AI tool — your entire team can use it together.

```
「Product Discussion」
  👤 Alice (Product Manager)
  👤 Bob (Designer)
  👤 Charlie (Developer)
  🤖 Lobster (AI Assistant)

Alice: Can you analyze the technical feasibility of this feature?
🦞 Lobster: Based on the requirements, I've analyzed three aspects...
Bob: @Lobster Any color scheme suggestions?
🦞 Lobster: From a UI/UX perspective, I recommend...
Charlie: How long would this take to implement?
🦞 Lobster: Based on the current tech stack, estimated...
```

One deployment, the whole team benefits:

- **Companies/Teams** — Everyone discusses with AI in the same group, stay aligned, no relay needed
- **Families** — Add an account for each family member, everyone gets their own AI assistant
- **Studios** — Different projects get different groups, each with specialized Agents
- **Education** — Teachers and students in the same group, AI-assisted learning

`openclaw rocketchat add-user` adds a new member in one command, `openclaw rocketchat invite` pulls them into any group. **No per-person deployment, no per-person configuration — one service for everyone.**

### 8. 🔒 Fine-Grained Permission Control

Not everyone needs to talk to AI — some people just need to watch.

| Permission | View Messages | Send Messages | DM Bots | Use Case |
|---|---|---|---|---|
| **Full Access** | ✅ | ✅ | ✅ | Regular team members |
| **Read-Only** | ✅ | ❌ | ❌ | Boss monitoring, auditing, observers |

Typical scenarios:
- **Boss/Manager** — Read-only, review team-AI conversations anytime, track project progress
- **Interns** — Read-only, observe senior staff's AI discussions, learn and grow
- **Clients** — Read-only, see AI-generated analysis reports without interfering
- **Audit/Compliance** — Read-only, monitor AI usage for regulatory compliance

```bash
openclaw rocketchat add-user
# Choose during setup:
#   1) Full access — can send messages in groups and DM bots
#   2) Read-only — can only view group messages, no sending or DM
```

**No other platform offers this** — on Telegram or WhatsApp, users either see everything and can say everything, or see nothing at all.

### 9. 📱 Cross-Platform

Official Rocket.Chat clients: [rocket.chat/download-apps](https://www.rocket.chat/download-apps)

| Platform | How to Download |
|---|---|
| **iOS** | Search **"Rocket.Chat"** on App Store (developer: Rocket.Chat Technologies Corp)<br>Available in China App Store — no account switching needed |
| **Android** | Search **"Rocket.Chat"** on Google Play, or download APK from the official site |
| **macOS** | [Mac App Store](https://apps.apple.com/app/rocket-chat/id1148741252) or [download .dmg](https://www.rocket.chat/download-apps) |
| **Windows** | [Download installer](https://www.rocket.chat/download-apps) |
| **Linux** | [Download](https://www.rocket.chat/download-apps) (.deb / .rpm / Snap) |
| **Web** | No download needed — open `https://YOUR-IP.sslip.io` in any browser |

> 💡 **Search tip**: In App Store / Google Play, search "Rocket.Chat" and look for the developer **Rocket.Chat Technologies Corp**.

Deploy once, access from phone, computer, tablet, or browser. Messages sync across all devices in real time.

### 10. 🆓 Completely Free, Open Source, No Vendor Lock-In

- No subscription fees, no message limits, no feature restrictions
- MIT license — modify as you wish
- Built on Rocket.Chat's open-source ecosystem with an active community
- **No vendor lock-in** — export your data anytime (standard MongoDB format)
- You're running a standard Rocket.Chat server — plug in more features in the future (video calls, file sharing, webhook integrations, etc.)

## Comparison

|  | Feishu | Telegram | WhatsApp | This Plugin |
|---|---|---|---|---|
| **China Available** | ✅ | ❌ VPN needed | ❌ Foreign # needed | ✅ |
| **Setup Complexity** | 🔴 High | 🔴 High (VPN) | 🔴 High | 🟢 One command |
| **Dedicated AI Space** | ❌ Mixed with work | ❌ Mixed with social | ❌ Mixed with social | ✅ Dedicated |
| **Dedicated Notifications** | ❌ Mixed | ❌ Buried | ❌ Buried | ✅ Standalone |
| **Data Privacy** | 🟡 Via Feishu servers | 🟡 Via TG servers | 🟡 Via Meta servers | 🟢 Fully local |
| **Multi-Agent** | Manual config | Supported | Supported | ✅ Interactive setup |
| **Group Multi-Bot** | Limited | Supported | Not supported | ✅ Supported |
| **Multi-User Team** | Enterprise only | ❌ Separate setups | ❌ Separate setups | ✅ One deploy for all |
| **Permission Control** | Enterprise only | ❌ | ❌ | ✅ Full/Read-Only |
| **Split Deployment** | ❌ | ❌ | ❌ | ✅ Home LAN works |
| **Self-Hosted** | ❌ | ❌ | ❌ | ✅ |
| **Free** | Limited | Yes | Yes | ✅ Completely free |
| **Open Source** | ❌ | ❌ | ❌ | ✅ MIT |

## Quick Start

### Prerequisites

- [OpenClaw](https://docs.openclaw.ai/) installed
- A server with a **public IP** (AWS, DigitalOcean, etc.)
- Firewall / security group allows **port 443** (HTTPS)

### Step 1: Deploy Rocket.Chat

Run the one-click install script on your server (works for both local and remote):

```bash
bash install-rc.sh
```

Or install remotely without downloading first:

```bash
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
```

The script will automatically:
- Detect and install Docker (if not present)
- Deploy Rocket.Chat + MongoDB + Nginx (all Docker containers)
- Auto-configure **sslip.io free domain** (e.g. `123-45-67-89.sslip.io`)
- Prioritize **Let's Encrypt real HTTPS cert**; fall back to self-signed if unavailable
- Disable email two-factor auth (no mail server on self-hosted)
- Rocket.Chat communicates internally only — **port 3000 is not exposed to the public**

You'll see:

```
╔══════════════════════════════════════════════════════════╗
║   Rocket.Chat One-Click Install (HTTPS + OpenClaw)       ║
╚══════════════════════════════════════════════════════════╝

  ⏳ Detecting Docker...
  ✅ Docker installed (v29.2.1)
  ✅ Docker Compose installed (v5.0.2)
  ✅ Port 443 available
  ⏳ Getting server public IP...
  ✅ Public IP: 123.45.67.89
  ⏳ Configuring sslip.io domain: 123-45-67-89.sslip.io
  ⏳ Requesting Let's Encrypt certificate...
  ✅ Let's Encrypt certificate obtained! (auto-renew enabled)
  ⏳ Generating Nginx config...
  ✅ Nginx config generated
  ⏳ Generating docker-compose.yml...
  ✅ Config generated
  ⏳ Pulling images & starting (first time ~2-5 min)...
  ✅ Rocket.Chat is ready!

╔══════════════════════════════════════════════════════════╗
║              🎉 Rocket.Chat installed!                    ║
╚══════════════════════════════════════════════════════════╝

  Domain:  123-45-67-89.sslip.io (auto-configured via sslip.io)
  Address: https://123-45-67-89.sslip.io
  HTTPS:   ✅ Let's Encrypt certificate (trusted, zero warnings)

  📌 Next steps:
     1️⃣  Make sure firewall allows port 443
     2️⃣  On your OpenClaw machine, install plugin and configure:
         openclaw plugins install openclaw-rocketchat
         openclaw rocketchat setup
     3️⃣  Add an AI bot:
         openclaw rocketchat add-bot
```

> No Docker? The script auto-installs it.

### Step 2: Install Plugin + Configure Connection

Back on your OpenClaw machine:

```bash
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
```

You'll see:

```
=== Rocket.Chat Setup Wizard ===

Rocket.Chat server address
  (local: https://127.0.0.1, remote: https://IP.sslip.io)
  [default https://127.0.0.1]: https://123-45-67-89.sslip.io

  ⏳ Testing connection to https://123-45-67-89.sslip.io ...
  ✅ Connected! Rocket.Chat version: 8.1.0

Admin account
  1) Auto-create new admin (recommended for fresh installs)
  2) Use existing admin account
Choose: 1

  ⏳ Creating admin (internal, you don't need to remember)...
  Public registration disabled (secure)
  Email two-factor auth disabled
  ✅ Admin created

Create your phone login account
Username: zhangsan
Password: ********
Confirm:  ********

  ⏳ Creating account zhangsan...
  ✅ Account zhangsan created
  ⏳ Writing openclaw.json config...
  ✅ Config saved

╔══════════════════════════════════════════╗
║          🎉 Setup complete!              ║
╚══════════════════════════════════════════╝

  📱 Phone setup:
     1. Download "Rocket.Chat" from App Store
     2. Open the app, server address: https://123-45-67-89.sslip.io
        HTTPS cert is trusted — no warnings, connects directly
     3. Username: zhangsan
     4. Password: the one you just set

  🔥 Important: Make sure your server firewall allows port 443

  💡 Next: openclaw rocketchat add-bot
```


### Step 3: Add an AI Bot

```bash
openclaw rocketchat add-bot
```

Here's what you'll see:

```
=== Add Rocket.Chat Bot ===

Bot username: molty
Display name [default molty]: Lobster

Bind to which Agent?
  Available Agents:
    1) main (default)
    2) work (Work Helper)
  Select: 1

  ⏳ Creating bot user molty...
  ✅ Bot user molty created
  ⏳ Establishing DM between zhangsan and molty...
  ✅ DM ready
  ⏳ Writing config + binding...
  ✅ Config updated

  ✅ Bot molty (Lobster) created
     Bound to Agent: main
     DM ready

  📱 Open Rocket.Chat App to see molty — send a message to start!
```

**Type a bot name, pick an Agent number, done.**

### Step 4: Download Rocket.Chat on Your Phone, Start Chatting

1. Download Rocket.Chat App
   - **iPhone**: Search **"Rocket.Chat"** on App Store
   - **Android**: Search **"Rocket.Chat"** on Google Play, or download APK from the [official site](https://www.rocket.chat/download-apps)
   - **Desktop**: [Download desktop client](https://www.rocket.chat/download-apps), or open `https://YOUR-IP.sslip.io` in your browser
2. Open the app, tap **"Add Server"**, enter: `https://YOUR-IP.sslip.io`
3. Login with the credentials from Step 1
4. Find the bot, send a message, start chatting!

**That's it. 3 commands + download an app. You're done.**

---

### More Features

These commands are optional — use them when you need them:

<details>
<summary><b>Remote Rocket.Chat installation (split deployment)</b></summary>

If you chose Mode B (split deployment), run on your remote VPS:

```bash
# SSH into your VPS, then one-click install:
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
```

The script will automatically:
- Detect and install Docker (if not present)
- Deploy Rocket.Chat + MongoDB + Nginx (HTTPS)
- Auto-configure **sslip.io free domain** + request **Let's Encrypt** cert (falls back to self-signed)
- Start services and wait until ready
- Output the `https://VPS-IP.sslip.io` address and next steps

After installation, go back to your OpenClaw machine and run `openclaw rocketchat setup`, enter `https://VPS-IP.sslip.io`.

</details>

<details>
<summary><b>Create multi-bot group</b></summary>

```bash
openclaw rocketchat add-group
```

```
=== Create Rocket.Chat Private Channel ===

Channel name: AI Squad

Add which bots?
  Available bots:
    1) molty (Lobster) -> Agent: main
    2) work-claw (Work Helper) -> Agent: work
  Select (comma-separated): 1,2

Add which users?
  Available users:
    1) zhangsan
  Select (comma-separated, Enter for all):

Require @mention to respond? [y/N]: n

  ✅ Channel "AI Squad" created
     Members: zhangsan, molty, work-claw
```

</details>

<details>
<summary><b>Add more phone users (family, colleagues)</b></summary>

```bash
openclaw rocketchat add-user
```

```
=== Add Phone Login User ===

Username: lisi
Password: ********
Confirm:  ********

User permission:
  1) Full access — can send messages in groups and DM bots
  2) Read-only — can only view group messages, no sending or DM
Choose: 1

Join existing groups?
  Available groups:
    1) AI Squad (bots: molty, work-claw)
  Select (comma-separated): 1

  ✅ User lisi created (full access)
     Permission: ✅ Full access
     Joined: AI Squad
     Login: https://123-45-67-89.sslip.io / Username: lisi

  📱 Tell lisi to download Rocket.Chat App, server: https://123-45-67-89.sslip.io
     Login with the username and password above, then:
     - Discuss with AI together in "AI Squad" group
     - DM any bot directly for one-on-one AI conversations
```

> **Read-only mode** is great for bosses monitoring progress, auditing, or observing. Read-only users can see all group messages but can't send messages or DM bots.

</details>

<details>
<summary><b>Remove a user</b></summary>

```bash
openclaw rocketchat remove-user
```

```
=== Remove Phone User ===

Select user to remove:
  1) lisi
  2) wangwu
Choose: 1

⚠️  About to delete user lisi — this cannot be undone!
   The user will be permanently removed from Rocket.Chat,
   removed from all groups, and DM history will be lost.

Confirm delete lisi? [y/N]: y

  ⏳ Removing from "AI Squad"...
  ✅ Removed from "AI Squad"
  ⏳ Deleting user lisi from Rocket.Chat...
  ✅ User lisi deleted from Rocket.Chat
  ⏳ Cleaning local records...
  ✅ Local records cleaned

  ✅ User lisi completely deleted
     Their Rocket.Chat App will no longer be able to log in.
```

</details>

<details>
<summary><b>Manage group members</b></summary>

```bash
openclaw rocketchat invite
```

```
=== Group Member Management ===

Select group:
  1) AI Squad
Choose: 1

Action:
  1) Invite user to group
  2) Remove user
  3) Set as admin (Moderator)
  4) Set as owner (Owner)
  5) Back
Choose: 1

Invite who?
  1) lisi
  2) wangwu
Choose: 1

  ⏳ Inviting lisi...
  ✅ lisi has joined "AI Squad"
```

</details>

<details>
<summary><b>Check running status</b></summary>

```bash
openclaw rocketchat status
```

```
=== Rocket.Chat Status ===

  Server:     Running - https://123-45-67-89.sslip.io
  MongoDB:    Running

Users
  zhangsan    lisi 🔒readonly

Bots                          Agent           Status
  molty (Lobster)             main            Online
  work-claw (Work Helper)     work            Online

Private Channels
  AI Squad     zhangsan(Owner), lisi, molty(Bot), work-claw(Bot)
```

</details>

<details>
<summary><b>Uninstall</b></summary>

```bash
openclaw rocketchat uninstall
```

</details>

## Commands

| Command | Description |
|---|---|
| `openclaw rocketchat setup` | Connect to Rocket.Chat (HTTPS) + create admin + create phone account |
| `openclaw rocketchat add-bot` | Add bot + bind Agent + create DM |
| `openclaw rocketchat add-group` | Create private channel (multi-bot group) |
| `openclaw rocketchat add-user` | Add phone login user |
| `openclaw rocketchat remove-user` | Remove phone login user |
| `openclaw rocketchat invite` | Manage group members |
| `openclaw rocketchat status` | View running status (with Agent health check) |
| `openclaw rocketchat uninstall` | Uninstall Rocket.Chat |

All commands are **interactive** — no flags to memorize, just follow the prompts.

## Config Example

All config is written automatically by CLI commands into `openclaw.json` — you don't need to edit it manually:

```json5
{
  // Agents are managed by openclaw agents add (plugin doesn't touch these)
  agents: {
    list: [
      { id: "main", default: true },
      { id: "work", name: "Work Helper" },
    ],
  },

  // Everything below is written automatically by plugin CLI commands
  bindings: [
    { agentId: "main", match: { channel: "rocketchat", accountId: "molty" } },
    { agentId: "work", match: { channel: "rocketchat", accountId: "work-claw" } },
  ],
  channels: {
    rocketchat: {
      enabled: true,
      serverUrl: "https://123-45-67-89.sslip.io",
      accounts: {
        molty: { botUsername: "molty", botDisplayName: "Lobster" },
        "work-claw": { botUsername: "work-claw", botDisplayName: "Work Helper" },
      },
      groups: {
        "AI Squad": { requireMention: false, bots: ["molty", "work-claw"] },
      },
    },
  },
}
```

## Architecture

### Mode A: Co-located

Everything on one server — simplest setup.

```
┌─────────────────────────────────────────────┐
│              📱 Your Phone                   │
│           Rocket.Chat App                    │
└─────────────┬───────────────────────────────┘
              │ HTTPS (:443)
┌─────────────▼───────────────────────────────┐
│       Your Server (one machine does it all)  │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Docker                               │   │
│  │  ┌───────┐  ┌──────────┐  ┌───────┐  │   │
│  │  │ Nginx │─▸│Rocket.Chat│─▸│MongoDB│  │   │
│  │  │ :443  │  │  :3000   │  │       │  │   │
│  │  │(HTTPS)│  │(internal)│  │       │  │   │
│  │  └───────┘  └──────────┘  └───────┘  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  OpenClaw Gateway                     │   │
│  │  @openclaw/rocketchat plugin          │   │
│  │  ┌─────────────┐                     │   │
│  │  │ Agent: main │                     │   │
│  │  │ Agent: work │                     │   │
│  │  └─────────────┘                     │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Mode B: Split Deployment

RC on a cloud VPS, OpenClaw on home network or low-spec machine. Great when you don't have a public IP or need to save memory.

```
┌─────────────────────────────────────────────┐
│              📱 Your Phone                   │
│           Rocket.Chat App                    │
└─────────────┬───────────────────────────────┘
              │ HTTPS (:443)
┌─────────────▼───────────────────────────────┐
│    Cloud VPS (cheap 1C1G is enough)          │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Docker (install-rc.sh one-click)     │   │
│  │  ┌───────┐  ┌──────────┐  ┌───────┐  │   │
│  │  │ Nginx │─▸│Rocket.Chat│─▸│MongoDB│  │   │
│  │  │ :443  │  │  :3000   │  │       │  │   │
│  │  │(HTTPS)│  │(internal)│  │       │  │   │
│  │  └───────┘  └─────▲────┘  └───────┘  │   │
│  └───────────────────┼──────────────────┘   │
└──────────────────────┼───────────────────────┘
                       │ HTTPS/WebSocket (public network)
┌──────────────────────┼───────────────────────┐
│       Home Network / Local Machine            │
│                      │                        │
│  ┌───────────────────┴──────────────────┐    │
│  │  OpenClaw Gateway                     │    │
│  │  @openclaw/rocketchat plugin          │    │
│  │  (connects to remote RC via internet) │    │
│  │                                       │    │
│  │  ┌─────────────┐                      │    │
│  │  │ Agent: main │                      │    │
│  │  │ Agent: work │                      │    │
│  │  └─────────────┘                      │    │
│  └───────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

> For Mode B, just run `install-rc.sh` on your remote VPS to install Rocket.Chat (with Nginx HTTPS + auto sslip.io domain), then run `openclaw rocketchat setup` locally and enter `https://VPS-IP.sslip.io`.

## FAQ

<details>
<summary><b>Setup says "registration is disabled" — what do I do?</b></summary>

This means setup was previously run and auto-disabled public registration. Solutions:

**Option 1: Reset Rocket.Chat (recommended, cleanest)**

```bash
cd ~/rocketchat && docker compose down -v
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
openclaw rocketchat setup
openclaw rocketchat add-bot
```

**Option 2: Use existing admin**

If you know the admin username/password, re-run setup and choose "Use existing admin account".

</details>

<details>
<summary><b>How to reinstall the plugin / start over?</b></summary>

```bash
# 1. Remove old plugin
rm -rf ~/.openclaw/extensions/openclaw-rocketchat

# 2. Clean residual config entries
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
for key in ['entries', 'installs']:
    if 'plugins' in cfg and key in cfg['plugins'] and 'openclaw-rocketchat' in cfg['plugins'][key]:
        del cfg['plugins'][key]['openclaw-rocketchat']
with open('$HOME/.openclaw/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
    f.write('\n')
"

# 3. Reinstall
npm cache clean --force
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
```

</details>

<details>
<summary><b>How to completely start fresh (including Rocket.Chat reset)?</b></summary>

```bash
# 1. Stop and remove Rocket.Chat containers and data
cd ~/rocketchat && docker compose down -v

# 2. Remove plugin and credentials
rm -rf ~/.openclaw/extensions/openclaw-rocketchat
rm -rf ~/.openclaw/credentials/rocketchat

# 3. Clean config file
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
for key in ['entries', 'installs']:
    if 'plugins' in cfg and key in cfg['plugins'] and 'openclaw-rocketchat' in cfg['plugins'][key]:
        del cfg['plugins'][key]['openclaw-rocketchat']
if 'channels' in cfg and 'rocketchat' in cfg['channels']:
    del cfg['channels']['rocketchat']
cfg['bindings'] = [b for b in cfg.get('bindings', []) if b.get('match', {}).get('channel') != 'rocketchat']
with open('$HOME/.openclaw/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
    f.write('\n')
"

# 4. Start fresh
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
openclaw rocketchat add-bot
```

</details>

<details>
<summary><b>Rocket.Chat Docker management commands</b></summary>

```bash
# Check container status
docker ps

# View logs
cd ~/rocketchat && docker compose logs -f

# Stop service
cd ~/rocketchat && docker compose stop

# Start service
cd ~/rocketchat && docker compose start

# Restart service
cd ~/rocketchat && docker compose restart

# Completely uninstall (delete all data)
cd ~/rocketchat && docker compose down -v
```

</details>

<details>
<summary><b>What is sslip.io? Why don't I need to buy a domain?</b></summary>

[sslip.io](https://sslip.io) is a free wildcard DNS service that embeds IP addresses directly into domain names. For example:

- `166-88-11-59.sslip.io` automatically resolves to `166.88.11.59`
- `10-0-0-1.sslip.io` automatically resolves to `10.0.0.1`

This means **any server with a public IP gets a free domain instantly** — no registration, no DNS configuration, no annual fees.

Because sslip.io gives you a real domain name, the install script can request a **real Let's Encrypt HTTPS certificate**. Your phone app connects with a trusted "green lock" — zero warnings, zero manual trust steps.

sslip.io is:
- **Free** — no cost, no sign-up, no account needed
- **Instant** — works immediately for any IP address
- **Maintained by the open-source community** — [source code on GitHub](https://github.com/cunnie/sslip.io)
- **Reliable** — backed by multiple DNS servers worldwide

</details>

<details>
<summary><b>What about self-signed certificates? The app says "untrusted"</b></summary>

Self-signed certificates are now only a **fallback**. The install script first tries to obtain a **Let's Encrypt certificate** via sslip.io. In most cases this succeeds and your app connects with zero warnings.

Self-signed certificates are only used when Let's Encrypt is unavailable (e.g. port 80 blocked, rate limits, or network issues). If you do end up with a self-signed cert:

- It has the same encryption strength as a regular certificate (RSA 2048)
- The app will warn about an "untrusted certificate" on first connection — tap "Trust" or "Continue"
- It won't ask again after that

You can re-run the install script later to retry Let's Encrypt once the issue is resolved.
</details>

<details>
<summary><b>Are push notifications reliable in China?</b></summary>

When the app is in the foreground, messages arrive via WebSocket in real-time with zero delay. In the background, notifications go through APNs with ~1-5 second delay, occasionally lost — consistent with most apps' push behavior in China.
</details>

<details>
<summary><b>What message formats are supported?</b></summary>

Plain text, Markdown (with syntax highlighting), images, files, and voice messages. Rocket.Chat natively renders Markdown with code block highlighting.
</details>

<details>
<summary><b>Can multiple people use it?</b></summary>

Yes. Use `openclaw rocketchat add-user` to add more phone users (family, colleagues). Each person downloads Rocket.Chat and logs in with their own account.
</details>

## Tech Stack

- **TypeScript** — Consistent with the OpenClaw ecosystem
- **Rocket.Chat REST API** — User/group/message management
- **Rocket.Chat WebSocket (DDP)** — Real-time message subscription
- **Docker Compose** — One-click Rocket.Chat + MongoDB deployment
- **Vitest** — Unit testing

## Contributing

Contributions welcome! Whether it's bug reports, feature suggestions, or code:

1. Fork this repository
2. Create your branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to remote (`git push origin feature/amazing`)
5. Create a Pull Request

## License

[MIT](LICENSE) — Free to use, free to modify.

---

<div align="center">

**If this plugin helps you, please give it a Star ⭐**

**Every Star shows support for the Chinese developer community 🇨🇳**

[![Star History Chart](https://api.star-history.com/svg?repos=Kxiandaoyan/openclaw-rocketchat&type=Date)](https://star-history.com/#Kxiandaoyan/openclaw-rocketchat&Date)

*Making AI assistants accessible to every user in China*

</div>
