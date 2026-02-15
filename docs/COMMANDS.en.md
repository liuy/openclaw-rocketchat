[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Config](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md) · [Multi-Channel](MULTI-CHANNEL.en.md) · [Commands](COMMANDS.en.md)

# Command Reference

## Why `!` Instead of `/`?

Rocket.Chat has built-in slash commands (`/help`, `/join`, `/leave`, `/mute`, etc.). When you type a message starting with `/`, the **Rocket.Chat client intercepts it** before it reaches the AI bot.

To avoid conflicts, use the **`!` prefix** instead of `/` for OpenClaw commands in Rocket.Chat. The plugin automatically converts `!xxx` to OpenClaw's `/xxx` commands.

> These commands are **built into OpenClaw** — they are not custom features added by this plugin. The plugin simply translates the prefix (`!` → `/`) so you can use them within Rocket.Chat.

---

## Command List

### Common Commands

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!help` | `命令帮助` `命令列表` `查看命令` | Show the command help menu |
| `!reset` | `重置对话` `清空对话` `新对话` `开始新对话` | Clear conversation memory and start fresh |
| `!status` | `查看状态` `当前状态` | Show current Agent, model, and session status |
| `!compact` | `压缩对话` `压缩历史` | Compress conversation history to free context space |

### Extended Commands

All `!xxx` commands are automatically converted to OpenClaw's `/xxx`. If OpenClaw adds new commands in the future (e.g., `/model`, `/debug`), you can use `!model`, `!debug` immediately — **no plugin update needed**.

| Command | Function |
|---------|----------|
| `!xxx` | Automatically converted to OpenClaw's `/xxx` command |
| `!xxx args` | Commands with arguments are also supported, e.g., `!model gpt-4` |

---

## Usage

### Option 1: Command Format

Start with `!` followed by the command name:

```
!reset
!status
!compact
```

> **Note:** `!` must be the **first character** of the message. Exclamation marks in the middle of messages are not treated as commands.
> For example, `Great day! help` will NOT trigger any command.

### Option 2: Natural Language Phrases

Send the corresponding natural language phrase as the complete message:

```
重置对话
查看状态
压缩对话
```

> **Note:** The natural language phrase must be the **entire message** and must **exactly match** a phrase from the table above.
> For example, `重置对话` triggers a reset, but `帮我重置对话` does not (it will be sent to the AI as a regular message).

### Option 3: Natural Conversation

You can also use natural language to ask the AI to perform actions:

```
Please clear our conversation and start over
```

This message goes to the AI Agent, which may understand and act on your intent (depending on Agent capabilities).

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
@molty !status
```

In groups without @mention requirement, send commands directly.
