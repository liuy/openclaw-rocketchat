[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Configuration](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md)

# 🔒 Security Model & Credential Management

This document covers the security design, credential lifecycle, and backup/restore mechanism of the openclaw-rocketchat plugin.

---

## Table of Contents

- [Security Overview](#security-overview)
- [Admin Password Security](#admin-password-security)
- [Credential Storage Architecture](#credential-storage-architecture)
- [Backup & Restore Mechanism](#backup--restore-mechanism)
- [File Permissions](#file-permissions)
- [Security Best Practices](#security-best-practices)

---

## Security Overview

```
Install (install-rc.sh)              Setup (setup / add-bot)              Runtime
┌──────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│ Generate 20-char      │     │ Weak password detection   │     │ WebSocket + TLS  │
│ random password       │     │ → auto-hardening          │     │ authToken auth   │
│ ↓                    │     │ ↓                        │     │ No creds in logs │
│ Pass via env var to RC│ ──→ │ Store in secure dir (0600)│ ──→ │                  │
│ ↓                    │     │ ↓                        │     │                  │
│ Save to .rc-info (0600)│    │ Sync backup to            │     │                  │
│ ↓                    │     │ .rc-credentials            │     │                  │
│ Disable registration  │     │                          │     │                  │
└──────────────────────┘     └──────────────────────────┘     └──────────────────┘
```

## Admin Password Security

### Fresh Install (v0.7.1+)

`install-rc.sh` auto-generates a 20-character strong random password at install time:

```bash
# Password generation (/dev/urandom + base64)
RC_ADMIN_PASS=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
```

The password is passed to the Rocket.Chat container via the `ADMIN_PASS` Docker environment variable — **no weak credential window exists from the very first boot**.

Additionally, the script auto-enables:
- `Accounts_RegistrationForm: "Disabled"` — disables public registration
- `Accounts_TwoFactorAuthentication_By_Email_Enabled: "false"` — disables email 2FA (no mail service on self-hosted)

### Upgrading from Older Installs

If Rocket.Chat still uses the default `admin/admin`, `openclaw rocketchat setup` auto-detects and hardens:

1. Login with `admin/admin` succeeds → confirms weak credential
2. Calls RC API `users.update` to change password to 24-char strong random
3. New password saved to credential files and backup

```
Setup auto-hardening flow:
admin/admin login OK → generate strong password → API update → save creds → disable registration
```

## Credential Storage Architecture

All credentials are stored in two locations, serving as mutual backups:

```
~/.openclaw/credentials/rocketchat/    ← Plugin credential dir (may be lost on reinstall)
├── admin.json                         ← Admin userId + authToken + password
├── bots.json                          ← Bot userId + password / authToken
└── users.json                         ← User list + permissions

~/rocketchat/                          ← RC install dir (survives plugin reinstall)
├── .rc-info                           ← Install info (server URL, domain, admin creds)
├── .rc-credentials                    ← Full credential backup (admin, bots, user passwords)
├── docker-compose.yml
├── nginx.conf
└── ssl/
```

| File | Location | Purpose | After Plugin Reinstall |
|------|----------|---------|----------------------|
| `admin.json` | `~/.openclaw/credentials/` | Admin login | ❌ May be lost |
| `bots.json` | `~/.openclaw/credentials/` | Bot connections | ❌ May be lost |
| `.rc-info` | `~/rocketchat/` | Install info + setup auto-detection | ✅ Preserved |
| `.rc-credentials` | `~/rocketchat/` | Full credential backup | ✅ Preserved |

## Backup & Restore Mechanism

### Automatic Backup

Whenever credentials are created or updated, they are automatically synced to `~/rocketchat/.rc-credentials`:

- `saveAdminCredentials()` → auto-backs up admin credentials
- `saveBotCredentials()` → auto-backs up bot credentials
- `createPersonalAccount()` → auto-backs up user passwords

### Conflict Recovery (After Plugin Reinstall)

After reinstalling the plugin and running `setup` or `add-bot` again, if users/bots already exist in RC:

**Username conflict recovery (3-tier fallback):**

```
1. Read backup password from .rc-credentials → verify login → recovered
   ↓ failed
2. Try the password user just entered → if matches, recovered
   ↓ failed
3. Use admin privileges to force-reset password via API
```

**Bot name conflict recovery (2-tier fallback):**

```
1. Read backup password from .rc-credentials → verify login → recovered
   ↓ failed
2. Use admin privileges to force-reset password via API → save new creds
```

## File Permissions

| File | Permission | Description |
|------|-----------|-------------|
| `~/.openclaw/credentials/rocketchat/` | `0700` | Owner-only access |
| `admin.json` / `bots.json` / `users.json` | `0600` | Owner-only read/write |
| `~/rocketchat/.rc-info` | `0600` | Owner-only read/write |
| `~/rocketchat/.rc-credentials` | `0600` | Owner-only read/write |

> On Windows, Unix permissions are not set, but files are in the user's home directory and protected by NTFS ACLs by default.

## Security Best Practices

1. **Never share `.rc-info` or `.rc-credentials` files** — they contain plaintext passwords
2. **Never add credential directories to Git** — `~/.openclaw/credentials/` should always be excluded from version control
3. **Regularly check your firewall** — ensure only ports 443 and 80 are open
4. **HTTPS is mandatory** — `install-rc.sh` auto-configures Let's Encrypt certificates; never downgrade to HTTP
5. **Keep RC updated** — periodically `docker pull` to get the latest Rocket.Chat image
