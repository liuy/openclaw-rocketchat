[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Config](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md) · [Multi-Channel](MULTI-CHANNEL.en.md) · [Commands](COMMANDS.en.md)

# Command Reference

## Why `!` Instead of `/`?

Rocket.Chat has built-in slash commands (`/help`, `/join`, `/leave`, `/mute`, etc.). When you type a message starting with `/`, the **Rocket.Chat client intercepts it** before it reaches the AI bot.

To avoid conflicts, use the **`!` prefix** instead of `/` for OpenClaw commands in Rocket.Chat. The plugin automatically converts `!xxx` to OpenClaw's `/xxx` commands.

> **Important:** These commands are **built into OpenClaw** — they are not custom features added by this plugin. The plugin simply translates the prefix (`!` → `/`) so you can use them within Rocket.Chat.

---

## Everyday Commands

The most commonly used commands:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!help` | `命令帮助` `命令列表` `查看命令` | Show the command help menu |
| `!reset` | `重置对话` `清空对话` | Clear conversation memory and start fresh |
| `!new` | `新对话` `开始新对话` | Start new conversation (optional model: `!new gpt-5`) |
| `!model` | `切换模型` `模型列表` `查看模型` | View available models or switch current model |
| `!status` | `查看状态` `当前状态` | Show Agent, model, and session status |
| `!compact` | `压缩对话` `压缩历史` | Compress conversation history to free context space |
| `!abort` | `停止回复` `终止回复` | Immediately stop the AI's current response |

### `!model` Examples

```
!model              ← Show numbered model list
!model 3            ← Select model #3 from list
!model openai/gpt-5 ← Switch to a specific model
!model list         ← Show model list
!model status       ← Show detailed model/API config
```

### `!new` vs `!reset`

- `!reset` — Clear conversation, keep current model
- `!new` — Start fresh, optionally switch model (e.g., `!new gpt-5`)

---

## Advanced Commands

For users who want fine-grained control over AI behavior:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!think <level>` | `思考深度` | Set reasoning depth (off/minimal/low/medium/high) |
| `!agents` | `代理列表` `查看代理` | View available Agent list |
| `!agent <id>` | — | View or switch to a specific Agent |
| `!usage` | `查看用量` `用量统计` | Show token usage and cost statistics |
| `!context` | `查看上下文` `上下文信息` | Show context size breakdown (system prompt, tools, skills, etc.) |
| `!whoami` | — | Show your sender identity |
| `!commands` | — | Show full OpenClaw command list |
| `!reasoning <on/off>` | — | Toggle separate AI reasoning output |
| `!verbose <on/off>` | — | Toggle debug information display |
| `!usage <level>` | — | Set usage display level (off/tokens/full/cost) |

### `!think` Levels

| Level | Description |
|-------|-------------|
| `off` | No reasoning (fastest, cheapest) |
| `minimal` | Minimal reasoning |
| `low` | Light reasoning |
| `medium` | Moderate reasoning (default) |
| `high` | Deep reasoning (slowest, most accurate) |

> **Note:** `!verbose` and `!reasoning` should be used carefully in groups — they may expose internal AI reasoning to all group members.

---

## Admin Commands

Require admin permissions or special configuration:

| Command | Function |
|---------|----------|
| `!elevated <on/off/ask/full>` | Manage privilege escalation level |
| `!exec` | View or configure code execution sandbox |
| `!activation <mention/always>` | Set group activation mode (@mention/always respond) |
| `!session` | View current session info |
| `!sessions` | View all sessions |
| `!approve <allow-once/deny>` | Approve or deny code execution requests |
| `!subagents` | View or manage sub-agents |
| `!skill <name>` | Run a skill by name |
| `!config` | View or modify persistent config (requires `commands.config: true`) |
| `!debug` | Runtime debug overrides (requires `commands.debug: true`) |

> Admin commands require the sender to be in the `commands.allowFrom` allowlist or authorized via channel access groups. Unauthorized command-only messages are silently ignored.

---

## Not Applicable Commands

These OpenClaw commands are **not applicable or not recommended** in Rocket.Chat:

| Command | Reason |
|---------|--------|
| `!bash` / `! command` | Executes shell commands on server, high security risk, disabled by default |
| `!dock-slack` / `!dock-telegram` | Cross-channel docking, only meaningful on corresponding platforms |
| `!restart` / `!stop` | Gateway service control, disabled by default |
| `!send` | Owner-only, controls message sending behavior |
| `!tts` | Text-to-speech, not supported by Rocket.Chat App |
| `!queue` | Advanced message queue settings, rarely needs manual adjustment |

---

## Usage

### Option 1: Command Format

Start with `!` followed by the command name:

```
!reset
!model openai/gpt-5
!think high
!status
```

> **Note:** `!` must be the **first character** of the message. Exclamation marks in the middle of messages are not treated as commands.
> For example, `Great! reset` will NOT trigger a command.

### Option 2: Natural Language Phrases

Send the corresponding phrase as the complete message (exact match required):

```
重置对话
切换模型
查看状态
```

> **Note:** The phrase must be the **entire message** and must **exactly match** a phrase from the tables above.
> For example, `重置对话` triggers a reset, but `帮我重置对话` does not (sent to AI as regular message).

### Option 3: Natural Conversation

You can also ask the AI in natural language:

```
Please clear our conversation and start over
```

This goes to the AI Agent, which may understand and act on your intent.

---

## Commands vs Natural Conversation

| | Command (`!reset`) | NL Phrase (`重置对话`) | Natural Conversation |
|--|:---:|:---:|:---:|
| Execution | OpenClaw direct | Converted to command | AI interprets |
| Speed | Fastest (skips AI) | Fastest (skips AI) | Slower (AI processing) |
| Accuracy | 100% precise | 100% precise | Depends on AI |
| Best for | Power users | Casual users | Complex requests |

---

## Using Commands in Groups

Commands work the same in groups as in DMs. If the group has `@mention` mode enabled (`requireMention: true`), prefix with the bot mention:

```
@molty !reset
@molty !model list
@molty !think high
```

In groups without @mention requirement, send commands directly.

---

## Extensibility

All `!xxx` commands are automatically converted to OpenClaw's `/xxx`. If OpenClaw adds new commands in the future, you can use them with the `!` prefix immediately — **no plugin update needed**.

Similarly, custom commands registered by OpenClaw plugins (e.g., OpenProse) can also be used with the `!` prefix in Rocket.Chat.
