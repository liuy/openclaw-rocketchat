[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Configuration](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md)

# Usage Guide

## Detailed Quick Start

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
- Auto-obtains **Let's Encrypt HTTPS cert** via acme.sh (auto-renewal every 60 days)
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

  🔑 Admin credentials (strong password auto-generated):
     Username: admin
     Password: Kx8mVp2dRfT7nQwL3s9A
   (Saved to ~/rocketchat/.rc-info — setup will auto-read it.
    Regular users don't need this account — it's for server administration only.)

  Install info saved to: ~/rocketchat/.rc-info

  📌 Next steps:
     1️⃣  Make sure firewall allows ports 443 and 80
     2️⃣  Install plugin and configure:
         openclaw plugins install openclaw-rocketchat
         openclaw rocketchat setup
         💡 On the same machine, setup auto-detects install info — no manual input needed!
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

  ✅ Detected local Rocket.Chat installation
    Server URL: https://123-45-67-89.sslip.io
    Domain: 123-45-67-89.sslip.io
    Admin: admin

  Use detected info for auto-configuration? (recommended) (Y/n): Y

  Using detected server address: https://123-45-67-89.sslip.io
  ⏳ Testing connection to https://123-45-67-89.sslip.io ...
  ✅ Connected! Rocket.Chat version: 8.1.0

  ⏳ Creating admin (internal, you don't need to remember)...
  Default admin password changed to strong random password (secure)
  Public registration disabled (secure)
  ✅ Admin ready

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

  💡 About the admin or rc-admin user you may see in the App:
     This is Rocket.Chat's internal admin account, auto-created by setup,
     used to manage bots and users. You can ignore it — don't delete it.

  🔥 Important: Make sure your server firewall allows ports 443 and 80

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

  📱 Open Rocket.Chat App to chat with the bot:
     If you don't see Lobster in your conversation list, tap the search icon
     in the top-left corner and type "molty" to find and start a DM.
```

**Type a bot name, pick an Agent number, done.**

### Step 4: Download Rocket.Chat on Your Phone, Start Chatting

1. Download Rocket.Chat App
   - **iPhone**: Search **"Rocket.Chat"** on App Store
   - **Android**: Search **"Rocket.Chat"** on Google Play, or download APK from the [official site](https://www.rocket.chat/download-apps)
   - **Desktop**: [Download desktop client](https://www.rocket.chat/download-apps), or open `https://YOUR-IP.sslip.io` in your browser
2. Open the app, tap **"Add Server"**, enter: `https://YOUR-IP.sslip.io`
3. Login with the credentials from Step 1
4. If you don't see the bot in your conversation list, tap the search icon in the top-left corner, type the bot's username to find and start chatting!

**That's it. 3 commands + download an app. You're done.**

---

## Remote Rocket.Chat Installation (Split Deployment)

If you chose Mode B (split deployment), run on your remote VPS:

```bash
# SSH into your VPS, then one-click install:
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
```

The script will automatically:
- Detect and install Docker (if not present)
- Deploy Rocket.Chat + MongoDB + Nginx (HTTPS)
- Auto-configure **sslip.io free domain** + request **Let's Encrypt** cert via acme.sh
- Start services and wait until ready
- Output the `https://VPS-IP.sslip.io` address and next steps

After installation, go back to your OpenClaw machine and run `openclaw rocketchat setup`, enter `https://VPS-IP.sslip.io`.

---

## Create Multi-Bot Group

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

---

## Add More Phone Users (Family, Colleagues)

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

---

## Remove a User

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

---

## Manage Group Members

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

---

## Check Running Status

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

---

## Upgrade Plugin

```bash
openclaw rocketchat upgrade
```

One command does it all: shows version comparison, backs up config, stops Gateway, removes old version, installs new version, restores config.
Fully automatic — **no bot, group, or binding config is lost**.

---

## Uninstall

```bash
openclaw rocketchat uninstall
```

Interactive guide — you can choose whether to also clean up Docker containers and data.
