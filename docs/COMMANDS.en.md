[Home](../README.en.md) · [Guide](GUIDE.en.md) · [FAQ](FAQ.en.md) · [Config](CONFIGURATION.en.md) · [Architecture](ARCHITECTURE.en.md) · [Security](SECURITY.en.md) · [Multi-Agent](MULTI-AGENT.en.md) · [Multi-Channel](MULTI-CHANNEL.en.md) · [Commands](COMMANDS.en.md)

# Command Reference

## Why `!` Instead of `/`?

Rocket.Chat has built-in slash commands (`/help`, `/join`, `/leave`, `/mute`, etc.). When you type a message starting with `/`, the **Rocket.Chat client intercepts it** before it reaches the AI bot.

To avoid conflicts, use the **`!` prefix** instead of `/` for OpenClaw commands in Rocket.Chat. The plugin automatically converts `!xxx` to OpenClaw's `/xxx` commands.

> **Important:** These commands are **built into OpenClaw** — they are not custom features added by this plugin. The plugin simply translates the prefix (`!` → `/`) so you can use them within Rocket.Chat.

---

## Context Management

Manage conversation context and session state — the most commonly used commands:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!compact` | `压缩对话` `压缩上下文` | Use when conversation slows down. Compresses old messages to free context space |
| `!clear` | `清除会话` | Clears current session messages but **preserves AI's long-term memory** |
| `!reset` | `重置对话` `清空对话` | Complete restart. Clears all context and memory |
| `!new` | `新对话` `开始新对话` | Start fresh, optionally switch model (e.g., `!new glm`) |
| `!status` | `查看状态` `当前状态` | View current Agent, model, and token usage |

### Three Kinds of "Clear"

| Command | Clears Messages | Clears Memory | Switches Model | Use When |
|---------|:---:|:---:|:---:|----------|
| `!compact` | Compresses old | ❌ Kept | ❌ | Conversation too long, getting slow |
| `!clear` | ✅ All cleared | ❌ Kept | ❌ | Switching topics, but AI still remembers you |
| `!reset` | ✅ All cleared | ✅ All cleared | ❌ | Complete fresh start |
| `!new` | ✅ All cleared | ✅ All cleared | ✅ Optional | Fresh start with a different model |

---

## Model Switching

View and switch AI models:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!model` | `切换模型` `查看模型` | Show available models (numbered), pick a number to switch |
| `!model list` | `模型列表` | Show available model list |
| `!model status` | — | View current model's detailed config (API endpoint, key status, etc.) |
| `!model <name>` | — | Quick switch with fuzzy matching (e.g., `!model glm`, `!model claude`) |
| `!model <number>` | — | Switch by number from the model list (e.g., `!model 3`) |

### Examples

```
!model              ← Show numbered model list
!model 3            ← Select model #3
!model glm          ← Fuzzy match, switch to GLM series
!model openai/gpt-5 ← Exact provider/model
!model status       ← View detailed API config
```

---

## Tools and Skills

View and use the Agent's Tools and Skills:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!tools` | `查看工具` `工具列表` | List all tools available to the current Agent |
| `!skills` | `查看技能` `技能列表` | List installed Skills |
| `!skill <name>` | — | Run a specific Skill (e.g., `!skill summarize`) |

> Tools are functional interfaces the Agent can call (search, calculate, file operations, etc.).
> Skills are predefined complex task workflows (summarize docs, translate, code review, etc.).

---

## AI Behavior Control

Fine-tune AI output behavior:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!think <level>` | `思考深度` | Set AI reasoning depth, affects reply quality and speed |
| `!reasoning <on/off>` | — | When on, AI outputs reasoning process as a separate message |
| `!verbose <on/off>` | — | When on, shows debug info and tool call details |
| `!usage <level>` | `查看用量` `用量统计` | Control per-response usage statistics display |
| `!context` | `查看上下文` `上下文信息` | Show context window size breakdown |
| `!abort` | `停止回复` `终止回复` | Immediately stop the AI's current response |

### `!think` Levels

| Level | Speed | Token Cost | Use For |
|-------|:---:|:---:|---------|
| `off` | Fastest | Lowest | Simple Q&A, casual chat |
| `minimal` | Very fast | Low | Daily conversation |
| `low` | Fast | Moderate | General tasks (default) |
| `medium` | Medium | Higher | Complex analysis, long-form writing |
| `high` | Slower | Highest | Math reasoning, code debugging, complex decisions |

### `!usage` Levels

| Level | Description |
|-------|-------------|
| `off` | No usage info displayed |
| `tokens` | Show token count after each reply |
| `full` | Show full token and cost breakdown |
| `cost` | Show cumulative session cost summary |

> **Note:** `!verbose` and `!reasoning` should be used carefully in groups — they may expose internal AI reasoning and tool call details to all group members.

---

## Information Queries

View various runtime information:

| Command | Natural Language | Function |
|---------|-----------------|----------|
| `!help` | `命令帮助` `命令列表` `查看命令` | Show command help menu |
| `!commands` | — | Show full OpenClaw command list (more detailed than `!help`) |
| `!agents` | `代理列表` `查看代理` | View available Agents and current binding |
| `!agent <id>` | — | View or switch to a specific Agent |
| `!whoami` | — | Show your sender identity (for debugging) |

---

## Admin Commands

Require admin permissions or special configuration:

| Command | Function |
|---------|----------|
| `!elevated <on/off/ask/full>` | Manage privilege escalation (`full` skips all exec approvals) |
| `!exec` | View or configure code execution sandbox |
| `!activation <mention/always>` | Set group activation mode (@mention/always respond) |
| `!session` / `!sessions` | View current or all sessions |
| `!approve <allow-once/deny>` | Approve or deny code execution requests |
| `!subagents` | View or manage sub-agent runs |
| `!config` | View or modify persistent config (requires `commands.config: true`) |
| `!debug` | Runtime debug overrides (requires `commands.debug: true`) |

> Admin commands require sender to be in `commands.allowFrom` allowlist. Unauthorized command messages are silently ignored.

---

## Not Applicable Commands

These OpenClaw commands are **not applicable or not recommended** in Rocket.Chat:

| Command | Reason |
|---------|--------|
| `!bash` / `! command` | Executes shell commands on server, extreme security risk, disabled by default |
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
!compact
!model glm
!think high
!status
```

> **Note:** `!` must be the **first character** of the message. Exclamation marks in the middle of messages are not treated as commands.
> For example, `Great! reset` will NOT trigger a command.

### Option 2: Natural Language Phrases

Send the corresponding phrase as the complete message (exact match required):

```
压缩对话
切换模型
查看状态
```

> **Note:** The phrase must be the **entire message** and must **exactly match** a phrase from the tables above.
> For example, `重置对话` triggers a reset, but `帮我重置对话` does not (sent to AI as regular message).

---

## 💡 Most Used Commands

| Scenario | Command | What It Does |
|----------|---------|-------------|
| Conversation getting slow | `!compact` | Compress old messages, free up space |
| Want to try a different model | `!model glm` | Quick switch to GLM model |
| Check token usage | `!status` | View usage and status |
| Complete fresh start | `!reset` | Clear everything, back to initial state |
| AI reply too slow, want to stop | `!abort` | Immediately stop current reply |
| Switch topics but keep memory | `!clear` | Clear messages but preserve memory |

---

## Using Commands in Groups

Commands work the same in groups as in DMs. If the group has `@mention` mode enabled (`requireMention: true`), prefix with the bot mention:

```
@molty !reset
@molty !model glm
@molty !think high
```

In groups without @mention requirement, send commands directly.

---

## Extensibility

All `!xxx` commands are automatically converted to OpenClaw's `/xxx`. If OpenClaw adds new commands in the future, you can use them with the `!` prefix immediately — **no plugin update needed**.

Custom commands registered by OpenClaw plugins (e.g., OpenProse) can also be used with the `!` prefix in Rocket.Chat.
