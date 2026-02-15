[首页](../README.md) · [使用指南](GUIDE.md) · [常见问题](FAQ.md) · [配置参数](CONFIGURATION.md) · [架构](ARCHITECTURE.md) · [安全](SECURITY.md) · [多 Agent](MULTI-AGENT.md) · [多渠道](MULTI-CHANNEL.md)

# 多 Agent 指南

## 概述

OpenClaw 支持创建多个 Agent（AI 大脑），每个 Agent 可以有不同的人设、模型、工作空间和能力。通过 `openclaw-rocketchat` 插件，你可以将不同的 Rocket.Chat 机器人绑定到不同的 Agent，实现：

- **家庭助理**和**工作助理**分开，互不干扰
- **不同 AI 模型**给不同场景使用（如 GPT 做创作、GLM 做日常对话）
- **不同群组**由不同 Agent 负责回复

---

## 核心概念

### OpenClaw 的路由模型

```
用户消息 → Rocket.Chat → 插件 → 路由匹配 → Agent
```

路由规则通过 `bindings` 配置，核心匹配字段：

| 字段 | 说明 |
|------|------|
| `channel` | 频道类型，固定为 `"rocketchat"` |
| `accountId` | 机器人账号 ID（对应 `channels.rocketchat.accounts` 的 key） |

**路由原则：一个机器人 = 一个 Agent。** 用户发消息给哪个机器人，就由哪个 Agent 处理。

### 三层关系

```
Agent（AI 大脑）       机器人（Rocket.Chat 用户）       群组 / 私聊
    │                          │                            │
    │  bindings 绑定           │  accounts 配置             │  groups 配置
    │                          │                            │
    ├── main ◄────────────── molty ◄──────────── 私聊 / AI全能群
    │                          │
    └── work ◄────────────── work-bot ◄────────── 工作讨论群
```

---

## 方案一：多机器人路由（推荐）

**一个机器人绑定一个 Agent，通过多个机器人实现多 Agent。** 这是官方推荐的方式，最稳定、最简单。

### 步骤 1：创建多个 Agent

```bash
# OpenClaw 默认已有 main Agent
# 创建额外的 Agent
openclaw agents add work
openclaw agents add creative
```

每个 Agent 可以在 `~/.openclaw/agents/<name>/` 下独立配置 system prompt、模型偏好等。

### 步骤 2：为每个 Agent 创建对应的机器人

```bash
# 机器人 1：日常助手，绑定 main Agent
openclaw rocketchat add-bot
# 输入用户名: molty
# 显示昵称: 小龙虾
# 绑定 Agent: main

# 机器人 2：工作助手，绑定 work Agent
openclaw rocketchat add-bot
# 输入用户名: work-bot
# 显示昵称: 工作助手
# 绑定 Agent: work

# 机器人 3：创作助手，绑定 creative Agent
openclaw rocketchat add-bot
# 输入用户名: writer
# 显示昵称: 写作搭档
# 绑定 Agent: creative
```

### 步骤 3：按需创建群组

```bash
# 群组 1：日常群，只加一个机器人
openclaw rocketchat add-group
# 频道名称: 日常闲聊
# 选择机器人: molty
# @提及: N（所有消息都回复）

# 群组 2：工作群，加多个机器人
openclaw rocketchat add-group
# 频道名称: 工作讨论
# 选择机器人: molty, work-bot
# @提及: Y（需要 @机器人名 才回复，避免抢答）
```

### 生成的配置

执行完以上命令，`openclaw.json` 中会自动生成：

```json5
{
  "channels": {
    "rocketchat": {
      "enabled": true,
      "serverUrl": "https://127.0.0.1",
      "port": 443,
      "accounts": {
        "molty": { "botUsername": "molty", "botDisplayName": "小龙虾" },
        "work-bot": { "botUsername": "work-bot", "botDisplayName": "工作助手" },
        "writer": { "botUsername": "writer", "botDisplayName": "写作搭档" }
      },
      "groups": {
        "日常闲聊": { "requireMention": false, "bots": ["molty"] },
        "工作讨论": { "requireMention": true, "bots": ["molty", "work-bot"] }
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

### 使用方式

| 场景 | 操作 | 响应的 Agent |
|------|------|-------------|
| 私聊小龙虾 | 直接发消息 | main |
| 私聊工作助手 | 直接发消息 | work |
| 私聊写作搭档 | 直接发消息 | creative |
| 在「日常闲聊」群发消息 | 直接发 | main（molty 回复） |
| 在「工作讨论」群 @小龙虾 | `@molty 帮我看看这个方案` | main |
| 在「工作讨论」群 @工作助手 | `@work-bot 整理一下会议纪要` | work |

---

## 方案二：多群分流（同一机器人不同群不同 Agent）

**目前不支持。** OpenClaw 的 bindings 路由按 `channel` + `accountId` 匹配，不支持 `group` 级别的路由。也就是说，同一个机器人在所有群里都连接同一个 Agent。

**替代方案：** 为不同群创建不同的机器人，每个机器人绑定不同的 Agent。这是方案一的做法。

---

## 方案三：同群多 Agent 对话

**场景：** 一个群里有多个 Agent 角色参与讨论，比如"产品经理 Agent"和"技术顾问 Agent"在同一个群里各自回答问题。

### 直接支持（推荐）

在群里加入多个机器人，开启 `@提及` 模式：

```bash
openclaw rocketchat add-group
# 频道名称: 项目讨论
# 选择机器人: molty, work-bot   （选择多个）
# @提及: Y                       （必须开启，否则每条消息两个机器人都回复）
```

使用时：
- `@molty 从用户角度分析一下这个功能` → main Agent 回复
- `@work-bot 评估一下技术可行性` → work Agent 回复
- 不带 @ 的消息 → 没有机器人回复（避免抢答）

### 高级：Orchestrator 模式（需要自己开发）

如果你想要"一条消息自动分发给多个 Agent"或"Agent 之间互相对话"，OpenClaw 原生路由不直接支持。需要：

1. 创建一个**总控 Agent**（Orchestrator），绑定到群的机器人
2. 在总控 Agent 的 system prompt 或 skills 中定义调用逻辑
3. 总控 Agent 通过工具调用（tools / skills / webhooks）去调用其他 Agent
4. 其他 Agent 运行在各自的 workspace 或独立的 OpenClaw 实例上

这属于高级用法，超出了插件的范围，需要根据具体需求自行设计。

---

## 方案四：单机器人多 Persona（轻量方案）

如果你只是想"一个机器人能扮演多个角色"，不需要创建多个 Agent。在 Agent 的 system prompt 里定义多个 persona：

```
你是一个多功能助手。根据用户的 @ 前缀切换角色：
- 用户说 "写作：xxx" 时，你是一个专业写作助手
- 用户说 "代码：xxx" 时，你是一个编程专家
- 用户说 "翻译：xxx" 时，你是一个翻译官
- 其他情况下，你是一个通用日常助手
```

**优点：** 配置简单，只需一个机器人。
**缺点：** 所有角色共享同一个上下文和记忆，无法真正隔离。

---

## 各方案对比

| 特性 | 方案一：多机器人路由 | 方案三：同群多 Agent | 方案四：单机器人多 Persona |
|------|:---:|:---:|:---:|
| 配置复杂度 | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Agent 隔离 | ✅ 完全隔离 | ✅ 完全隔离 | ❌ 共享上下文 |
| 独立模型 | ✅ 每个 Agent 可用不同模型 | ✅ | ❌ |
| 独立记忆 | ✅ 每个 Agent 独立 workspace | ✅ | ❌ |
| 群内多角色 | 需开启 @提及 | ✅ 自然支持 | 通过 prompt 模拟 |
| 插件原生支持 | ✅ 开箱即用 | ✅ 开箱即用 | ✅ 开箱即用 |
| 需要额外开发 | ❌ | ❌（除 Orchestrator） | ❌ |

---

## 实战示例：家庭 + 工作分离

### 目标

- **家庭群**：全家人一起用，日常问答、菜谱推荐、作业辅导
- **工作群**：只有自己用，代码审查、文档撰写、会议纪要
- **私聊**：随时找不同助手

### 操作步骤

```bash
# 1. 创建 Agent
openclaw agents add home    # 家庭助手
openclaw agents add work    # 工作助手

# 2. 配置 Agent 的 system prompt（可选）
# 编辑 ~/.openclaw/agents/home/agent.md — 设定家庭助手人设
# 编辑 ~/.openclaw/agents/work/agent.md — 设定工作助手人设

# 3. 创建机器人
openclaw rocketchat add-bot
# 用户名: home-bot，昵称: 家庭小助手，绑定: home

openclaw rocketchat add-bot
# 用户名: work-bot，昵称: 工作搭档，绑定: work

# 4. 创建群组
openclaw rocketchat add-group
# 名称: 我们的家，机器人: home-bot，@提及: N

openclaw rocketchat add-group
# 名称: 工作空间，机器人: work-bot，@提及: N

# 5. 添加家人到家庭群
openclaw rocketchat add-user
# 用户名: mama，加入: 我们的家

openclaw rocketchat add-user
# 用户名: baba，加入: 我们的家

# 6. 重启 Gateway 生效
openclaw gateway stop && openclaw gateway start
```

### 最终效果

```
私聊 家庭小助手  →  home Agent  →  家庭场景的 AI
私聊 工作搭档    →  work Agent  →  工作场景的 AI

「我们的家」群   →  home-bot 自动回复  →  全家都能用
「工作空间」群   →  work-bot 自动回复  →  只有自己用
```

---

## 常见问题

### Q: 一个机器人可以绑定多个 Agent 吗？

不可以。一个机器人（accountId）只能绑定一个 Agent。如果你需要多个 Agent，请创建多个机器人。

### Q: 绑定关系可以改吗？

可以。手动编辑 `~/.openclaw/openclaw.json` 中 `bindings` 数组的 `agentId` 字段，然后重启 Gateway：

```bash
openclaw gateway stop && openclaw gateway start
```

### Q: 多个机器人在同一个群里会抢答吗？

如果 `requireMention` 设为 `false`（不需要 @），所有机器人都会回复每条消息。**强烈建议多机器人群开启 @提及模式**（`requireMention: true`），这样只有被 @ 的机器人才会回复。

### Q: Agent 数量有限制吗？

OpenClaw 本身不限制 Agent 数量。但每个 Agent 背后有一个 AI 模型连接，过多 Agent 可能增加 API 开销。实际使用中 2-5 个 Agent 是比较合理的范围。

### Q: 不同 Agent 可以用不同的 AI 模型吗？

可以。在每个 Agent 的配置中指定不同的模型：

```bash
# 编辑 Agent 的配置
vi ~/.openclaw/agents/work/agent.md
```

或者在 `openclaw.json` 的 `agents.defaults.model` 中设置全局默认模型，在具体 Agent 配置中覆盖。
