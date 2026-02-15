[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Configuration](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md)

# FAQ & Troubleshooting

## Setup says "registration is disabled" — what do I do?

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

---

## How to upgrade the plugin?

```bash
openclaw rocketchat upgrade
```

One command does it all. Automatically backs up config → installs new version → restores config. **No bot, group, or binding config is lost.**

---

## How to start completely fresh (reconfigure from scratch)?

> Full reset steps also at [CONFIGURATION.en.md — Full Reset](CONFIGURATION.en.md#full-reset)

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

# 5. Reinstall (if you reset RC in step 3, run install-rc.sh first)
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
openclaw rocketchat add-bot
openclaw gateway start
```

---

## Rocket.Chat Docker management commands

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

---

## What is sslip.io? Why don't I need to buy a domain?

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

---

## What if certificate acquisition fails?

The `install-rc.sh` script uses **acme.sh** to auto-obtain Let's Encrypt certificates. If acquisition fails, common reasons include:

- **Firewall not allowing port 80** — Let's Encrypt validates via HTTP on port 80; ensure it's open
- **Port 80 occupied** — Another service (e.g. web server) may be using it
- **sslip.io DNS issues** — The script relies on sslip.io for domain resolution; check connectivity
- **Let's Encrypt rate limits** — Too many requests in a short period; wait and retry later

Fix the underlying issue, then re-run: `bash install-rc.sh --force`

---

## Are push notifications reliable in China?

When the app is in the foreground, messages arrive via WebSocket in real-time with zero delay. In the background, notifications go through APNs with ~1-5 second delay, occasionally lost — consistent with most apps' push behavior in China.

---

## What message formats are supported?

Plain text, Markdown (with syntax highlighting), images, files, and voice messages. Rocket.Chat natively renders Markdown with code block highlighting.

---

## Can multiple people use it?

Yes. Use `openclaw rocketchat add-user` to add more phone users (family, colleagues). Each person downloads Rocket.Chat and logs in with their own account.

See [Usage Guide — Add More Phone Users](GUIDE.en.md#add-more-phone-users-family-colleagues) for detailed steps.

---

## Code formatting in Rocket.Chat App

Code blocks in AI replies are **automatically syntax-highlighted and beautifully formatted** in Rocket.Chat App — unlike WeChat/DingTalk/Slack where code gets squished into unreadable blobs. A much better experience for developers and technical users.
