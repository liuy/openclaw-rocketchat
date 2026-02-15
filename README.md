<div align="center">

# 🦞 openclaw-rocketchat

**让中国用户也能优雅地使用 OpenClaw**

[![npm version](https://img.shields.io/npm/v/openclaw-rocketchat?color=red)](https://www.npmjs.com/package/openclaw-rocketchat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-Kxiandaoyan%2Fopenclaw--rocketchat-blue?logo=github)](https://github.com/Kxiandaoyan/openclaw-rocketchat)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

[English](./README.en.md) | **中文**

---

**通过 Rocket.Chat App 与你的 OpenClaw AI 助手对话**
**独立空间 · 独立通知 · 数据自控 · 无需 VPN**

</div>

---

## 痛点

OpenClaw 是一个强大的 AI 助手平台，海外用户可以通过 WhatsApp、Telegram、Discord 等随手对话。

**但中国大陆用户呢？**

- Telegram —— 需要 VPN，随时可能被封
- WhatsApp —— 需要外国手机号，使用不便
- Discord —— 被墙，完全无法使用
- 飞书 —— 配置复杂，需要企业账号，步骤繁琐

> 更大的问题是：即使能用这些平台，AI 对话和社交消息混在一起，重要的 AI 通知被淹没在社交噪音中。

## 解决方案

> **什么是 Rocket.Chat？** [Rocket.Chat](https://www.rocket.chat/) 是全球最大的开源企业级即时通讯平台，被全球 1200 万+ 用户使用，支持私有化部署。简单来说，它就是一个可以装在你自己服务器上的"企业微信/Slack"——界面成熟、功能完善、支持手机/电脑/网页多端，中国区 App Store 可直接下载。

本插件让你通过 **Rocket.Chat App** 与 OpenClaw 对话。

一条命令部署，三步开始使用。支持两种部署方式：

**方式 A：同机部署（推荐）**

```
用户手机（Rocket.Chat App）
       ↓ 直连 IP
你的机器（Rocket.Chat + OpenClaw）
       ↓ localhost
AI 大脑（OpenClaw Agent）
```

**方式 B：分离部署（内网/低配服务器友好）**

```
用户手机（Rocket.Chat App）
       ↓ 公网 IP
公网 VPS（只跑 Rocket.Chat + MongoDB）
       ↑ 插件通过公网连接
家庭内网 / 本地（OpenClaw + 本插件）
       ↓ localhost
AI 大脑（OpenClaw Agent）
```

> 方式 B 适用于：OpenClaw 在家庭内网无公网 IP、服务器内存不足想拆分、公司已有 RC 实例等场景。
> 在远程 VPS 上安装 RC 只需一条命令：`curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/main/install-rc.sh | bash`

**无论哪种方式，你的 AI 数据都不经过第三方。**

## 十大优势

### 1. 🏠 独立的 AI 对话空间

用 Telegram 和 AI 聊天？你的 AI 对话夹在朋友消息、群组通知、频道推送之间。重要的 AI 回复被淹没了。

**Rocket.Chat 是你专属的 AI 工作台。** 打开它，看到的全是你的 AI 助手——没有社交噪音，没有无关消息。一个 App 专注一件事。

### 2. 🔔 独立的推送通知

当 OpenClaw 给你发消息时，你收到的是来自 **Rocket.Chat** 的独立推送——不是 Telegram 的第 99 条未读，不是微信群里的第 200 条消息。

**你永远不会错过 AI 的重要回复。**

### 3. 🔐 数据完全自控

| 使用 Telegram | 使用本插件 |
|---|---|
| 消息经过 Telegram 服务器 | 消息只在你的机器上 |
| 聊天记录存在别人的云端 | 聊天记录存在你的 MongoDB |
| 你无法控制数据的去向 | Docker volume 是你的，想删就删 |
| 服务条款随时可能变更 | 你就是服务条款 |

**零信任第三方。你的 AI 对话、你的私人数据、你的工作内容，全部留在你自己的硬盘上。**

### 4. 🇨🇳 中国大陆完美可用

- Rocket.Chat App 在中国区 App Store / Google Play **可直接下载**
- 服务器部署在你自己的机器上，**不经过任何境外服务**
- 手机直连服务器 IP，**不需要域名、不需要 SSL、不需要备案**
- 不依赖任何被墙的服务

### 5. ⚡ 一条命令部署，两种部署模式

不需要看 10 页文档。不需要在浏览器里点来点去。不需要手动编辑 JSON 配置文件。

```bash
openclaw rocketchat setup
```

交互式向导全程引导，从 Docker 部署到账号创建到配置写入，一气呵成。

而且你可以灵活选择部署方式：

| | 同机部署 | 分离部署 |
|---|---|---|
| **适合谁** | 有公网服务器的用户 | 内网用户、低配服务器 |
| **RC 在哪** | 和 OpenClaw 同一台 | 单独一台公网 VPS |
| **安装方式** | `install-rc.sh` + `openclaw rocketchat setup` | VPS 上跑 `install-rc.sh`，本地连接 |
| **优点** | 最简单，一台搞定 | OpenClaw 可以在家里跑，RC 在云上 |

> 分离部署意味着即使你的 OpenClaw 在**家庭内网**没有公网 IP，只要有一台便宜的 VPS（1 核 1G 就够），就能让手机随时随地连接。

### 6. 🤖 多 Agent，多机器人

你可以在 OpenClaw 上创建多个 Agent（比如「个人助理」「工作助手」「代码审查」），每个 Agent 在 Rocket.Chat 里是一个独立的机器人：

```
会话列表
  🦞 小龙虾           ← 私聊：个人助理
  💼 工作助手          ← 私聊：工作 Agent
  🏠 AI全能群          ← 群聊：所有机器人都在
  📝 代码审查群         ← 群聊：专门的代码 Agent
```

**私聊和群聊并存**——简单问题私聊问一个机器人，复杂问题在群里让多个机器人一起讨论。

### 7. 👥 团队协作，多人共享 AI

这不只是一个人的 AI 工具——你的整个团队都可以用。

```
「产品讨论群」
  👤 张三（产品经理）
  👤 李四（设计师）
  👤 王五（开发）
  🤖 小龙虾（AI 助手）

张三：帮我们分析一下这个需求的技术可行性
🦞 小龙虾：根据需求描述，我分析了三个方面...
李四：@小龙虾 配色方案有什么建议？
🦞 小龙虾：从 UI/UX 角度，推荐以下方案...
王五：这个方案的实现周期大概多久？
🦞 小龙虾：基于当前技术栈，预估...
```

一个部署，全团队受益：

- **公司/团队** —— 所有人在同一个群里和 AI 讨论，信息对齐，不用传话
- **家庭** —— 给家人加个账号，人人都有自己的 AI 助手
- **工作室** —— 不同项目建不同群，每个群配不同的专业 Agent
- **教学场景** —— 老师和学生在同一个群里，AI 辅助教学

`openclaw rocketchat add-user` 一条命令添加新成员，`openclaw rocketchat invite` 把人拉进任意群组。**不需要每人单独部署，不需要每人单独配置，一套服务全员共享。**

### 8. 🔒 精细的权限管理

不是每个人都需要和 AI 对话——有些人只需要看。

| 权限 | 看群消息 | 发群消息 | 私聊机器人 | 适用场景 |
|---|---|---|---|---|
| **全功能** | ✅ | ✅ | ✅ | 普通团队成员 |
| **只读** | ✅ | ❌ | ❌ | 老板查看进度、审计、旁听 |

典型场景：
- **老板/领导** —— 只读权限，随时查看团队和 AI 的对话记录，掌握项目进度
- **实习生** —— 只读权限，旁听资深员工和 AI 的讨论，学习成长
- **客户** —— 只读权限，看到 AI 产出的分析报告，但不干预内部讨论
- **审计/合规** —— 只读权限，监控 AI 使用情况，确保合规

```bash
openclaw rocketchat add-user
# 创建时选择：
#   1) 全功能 —— 可以在群里发消息、私聊机器人
#   2) 只读 —— 只能查看群消息，不能发言也不能私聊
```

**其他平台都做不到这一点**——Telegram、WhatsApp 里要么全都能说，要么全都看不到。

### 9. 📱 全平台覆盖

Rocket.Chat 官方客户端下载：[rocket.chat/download-apps](https://www.rocket.chat/download-apps)

| 平台 | 下载方式 |
|---|---|
| **iOS** | App Store 搜索 **"Rocket.Chat"**（开发者：Rocket.Chat Technologies Corp）<br>中国区直接可下载，无需切换账号 |
| **Android** | Google Play 搜索 **"Rocket.Chat"**，或从官网下载 APK |
| **macOS** | [Mac App Store](https://apps.apple.com/app/rocket-chat/id1148741252) 或 [官网下载 .dmg](https://www.rocket.chat/download-apps) |
| **Windows** | [官网下载安装包](https://www.rocket.chat/download-apps) |
| **Linux** | [官网下载](https://www.rocket.chat/download-apps)（支持 .deb / .rpm / Snap） |
| **Web 端** | 无需下载，浏览器直接访问 `http://你的IP:3000` |

> 💡 **搜索技巧**：在 App Store / Google Play 中搜索 "Rocket.Chat"，认准开发者为 **Rocket.Chat Technologies Corp**。

一次部署，手机、电脑、平板、浏览器全通。多端消息实时同步。

### 10. 🆓 完全免费，完全开源，无厂商锁定

- 没有订阅费，没有消息条数限制，没有功能阉割
- MIT 协议，你想怎么改就怎么改
- 基于 Rocket.Chat 开源生态，社区活跃，长期维护
- **不绑定任何特定服务商**——不喜欢了可以随时迁移数据（MongoDB 标准格式导出）
- 你用的是标准的 Rocket.Chat 服务器，未来还可以接入更多功能（视频会话、文件共享、Webhook 集成等）

## 和其他方案的对比

|  | 飞书 | Telegram | WhatsApp | 本插件 |
|---|---|---|---|---|
| **中国区可用** | ✅ | ❌ 需VPN | ❌ 需外国号 | ✅ |
| **配置复杂度** | 🔴 高（企业账号） | 🔴 高（VPN） | 🔴 高 | 🟢 一条命令 |
| **AI 独立空间** | ❌ 混在工作消息中 | ❌ 混在社交中 | ❌ 混在社交中 | ✅ 专属 AI App |
| **独立推送** | ❌ 和工作混在一起 | ❌ 被社交淹没 | ❌ 被社交淹没 | ✅ 独立通知 |
| **数据隐私** | 🟡 经飞书服务器 | 🟡 经 TG 服务器 | 🟡 经 Meta 服务器 | 🟢 完全本地 |
| **多 Agent** | 需手动配置 | 支持 | 支持 | ✅ 交互式配置 |
| **群组多机器人** | 有限 | 支持 | 不支持 | ✅ 支持 |
| **多人团队共享** | 需企业版 | ❌ 各用各的 | ❌ 各用各的 | ✅ 一套服务全员用 |
| **权限管理** | 需企业版 | ❌ | ❌ | ✅ 全功能/只读 |
| **分离部署** | ❌ | ❌ | ❌ | ✅ 内网也能用 |
| **自托管** | ❌ | ❌ | ❌ | ✅ |
| **免费** | 有限制 | 是 | 是 | ✅ 完全免费 |
| **开源** | ❌ | ❌ | ❌ | ✅ MIT |

## 快速开始

### 前置条件

- [OpenClaw](https://docs.openclaw.ai/) 已安装
- 一台有**公网 IP** 的服务器（阿里云、腾讯云、AWS 等均可）
- 防火墙/安全组已放行 **3000 端口**（或你自定义的端口）

### 第一步：部署 Rocket.Chat

在你的服务器上运行一键安装脚本（本地或远程 VPS 都是同一条命令）：

```bash
bash install-rc.sh
```

或者远程一键安装（不用提前下载脚本）：

```bash
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/main/install-rc.sh | bash
```

你会看到：

```
╔══════════════════════════════════════════════════╗
║   Rocket.Chat 一键安装（OpenClaw 远程部署专用）     ║
╚══════════════════════════════════════════════════╝

  ⏳ 检测 Docker...
  ✅ Docker 已安装 (v29.2.1)
  ✅ Docker Compose 已安装 (v5.0.2)
  ✅ 端口 3000 可用
  ⏳ 生成 docker-compose.yml...
  ✅ 配置文件已生成
  ⏳ 拉取镜像并启动容器（首次约 2-5 分钟）...
  ✅ Rocket.Chat 已就绪！

╔══════════════════════════════════════════════════════════╗
║              🎉 Rocket.Chat 安装完成！                    ║
╚══════════════════════════════════════════════════════════╝

  服务器地址: http://123.45.67.89:3000

  📌 接下来的步骤：
     1️⃣  确保防火墙已放行端口 3000
     2️⃣  回到你的 OpenClaw 机器，运行：
         openclaw rocketchat setup
```

> 指定端口：`RC_PORT=4000 bash install-rc.sh`
> Docker 没装？脚本会自动安装。

### 第二步：安装插件 + 配置连接

回到你的 OpenClaw 机器，运行：

```bash
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
```

你会看到：

```
=== Rocket.Chat 配置向导 ===

Rocket.Chat 服务器地址
  （本机部署填 http://127.0.0.1:3000，远程填 http://公网IP:端口）
  [默认 http://127.0.0.1:3000]: http://123.45.67.89:3000

  ⏳ 测试连接 http://123.45.67.89:3000 ...
  ✅ 连接成功！Rocket.Chat 版本: 8.1.0

管理员账号
  1) 自动创建新管理员（推荐，适用于新装的 Rocket.Chat）
  2) 使用已有管理员账号
请选择: 1

  ⏳ 创建管理员（内部使用，你不需要记住）...
  ✅ 管理员已创建

创建你的手机登录账号
用户名: zhangsan
密码: ********
确认密码: ********

  ⏳ 创建账号 zhangsan...
  ✅ 账号 zhangsan 已创建
  ⏳ 写入 openclaw.json 配置...
  ✅ 配置已写入

╔══════════════════════════════════════════╗
║          🎉 配置完成！                    ║
╚══════════════════════════════════════════╝

  📱 手机操作：
     1. App Store 搜索下载 "Rocket.Chat"
     2. 打开 App，服务器填: http://123.45.67.89:3000
     3. 用户名: zhangsan
     4. 密码: 你设置的密码

  💡 下一步: 运行以下命令添加第一个机器人
     openclaw rocketchat add-bot
```

### 第三步：添加 AI 机器人

```bash
openclaw rocketchat add-bot
```

你会看到：

```
=== 添加 Rocket.Chat 机器人 ===

机器人用户名: molty
显示昵称 [默认 molty]: 小龙虾

绑定到哪个 Agent？
  当前 Agent:
    1) main (默认)
    2) work (工作助手)
  请选择: 1

  ⏳ 创建机器人用户 molty...
  ✅ 机器人用户 molty 已创建
  ⏳ 建立 zhangsan 与 molty 的私聊通道...
  ✅ DM 私聊已就绪
  ⏳ 写入配置 + 绑定...
  ✅ 配置已更新

  ✅ 机器人 molty (小龙虾) 已创建
     绑定到 Agent: main
     DM 私聊已就绪

  📱 打开 Rocket.Chat App 即可看到 molty，直接发消息开聊！
```

**输入机器人名字、选一个 Agent 编号，就完事了。**

### 第四步：手机下载 Rocket.Chat，开聊

1. 下载 Rocket.Chat App
   - **iPhone**：App Store 搜索 **"Rocket.Chat"**
   - **Android**：Google Play 搜索 **"Rocket.Chat"**，或从 [官网](https://www.rocket.chat/download-apps) 下载 APK
   - **电脑**：[官网下载桌面客户端](https://www.rocket.chat/download-apps)，或直接浏览器访问 `http://你的IP:3000`
2. 打开 App，点击 **"Add Server"**，输入服务器地址：`http://你的公网IP:3000`
3. 用第二步设置的用户名和密码登录
4. 找到第三步创建的机器人，发消息，开聊！

**到这里就全部完成了。总共 3 条命令 + 手机下载 App。**

---

### 更多功能

以下命令按需使用，不是必须的：

<details>
<summary><b>远程安装 Rocket.Chat（分离部署模式）</b></summary>

如果你选择方式 B（分离部署），在远程 VPS 上执行：

```bash
# SSH 登录你的 VPS 后，一键安装：
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/main/install-rc.sh | bash

# 或者指定端口：
RC_PORT=4000 bash install-rc.sh
```

脚本会自动：
- 检测并安装 Docker（如未安装）
- 拉取 Rocket.Chat + MongoDB 镜像
- 启动服务并等待就绪
- 输出服务器地址和后续步骤

安装完成后，回到你的 OpenClaw 机器运行 `openclaw rocketchat setup`，输入 VPS 上输出的地址即可。

</details>

<details>
<summary><b>创建多机器人群组</b></summary>

```bash
openclaw rocketchat add-group
```

```
=== 创建 Rocket.Chat 私有频道 ===

频道名称: AI全能群

添加哪些机器人？
  当前机器人:
    1) molty (小龙虾) -> Agent: main
    2) work-claw (工作助手) -> Agent: work
  请选择（逗号分隔）: 1,2

添加哪些用户？
  当前用户:
    1) zhangsan
  请选择（逗号分隔，回车默认全部）:

群内需要 @机器人名 才响应？[y/N]: n

  ✅ 私有频道「AI全能群」已创建
     成员: zhangsan, molty, work-claw
```

</details>

<details>
<summary><b>添加更多手机用户（家人、同事）</b></summary>

```bash
openclaw rocketchat add-user
```

```
=== 添加手机登录用户 ===

用户名: lisi
密码: ********
确认密码: ********

用户权限:
  1) 全功能 —— 可以在群里发消息、私聊机器人
  2) 只读 —— 只能查看群消息，不能发言也不能私聊
请选择: 1

加入哪些已有群组？
  当前群组:
    1) AI全能群 (机器人: molty, work-claw)
  请选择（逗号分隔）: 1

  ✅ 用户 lisi 已创建（全功能）
     权限: ✅ 全功能
     已加入: AI全能群
     登录: http://123.45.67.89:3000 / 用户名: lisi

  📱 告诉 lisi 下载 Rocket.Chat App，服务器填 http://123.45.67.89:3000
     用上面的用户名密码登录后，即可：
     - 在「AI全能群」里和团队一起跟 AI 讨论
     - 直接私聊任意机器人，进行一对一 AI 对话
```

> **只读模式** 适合老板查看进度、审计、旁听等场景。只读用户可以看到所有群聊内容，但不能发消息也不能私聊机器人。

</details>

<details>
<summary><b>删除用户</b></summary>

```bash
openclaw rocketchat remove-user
```

```
=== 删除手机登录用户 ===

选择要删除的用户:
  1) lisi
  2) wangwu
请选择: 1

⚠️  即将删除用户 lisi，此操作不可恢复！
   该用户将从 Rocket.Chat 服务器上永久删除，
   同时从所有群组中移除，DM 记录也将丢失。

确认删除 lisi？[y/N]: y

  ⏳ 从「AI全能群」移除...
  ✅ 已从「AI全能群」移除
  ⏳ 从 Rocket.Chat 删除用户 lisi...
  ✅ 用户 lisi 已从 Rocket.Chat 删除
  ⏳ 清理本地记录...
  ✅ 本地记录已清理

  ✅ 用户 lisi 已完全删除
     该用户的 Rocket.Chat App 将无法再登录。
```

</details>

<details>
<summary><b>群组成员管理</b></summary>

```bash
openclaw rocketchat invite
```

```
=== 群组成员管理 ===

选择群组:
  1) AI全能群
请选择: 1

操作:
  1) 邀请用户进群
  2) 移除用户
  3) 设为管理员 (Moderator)
  4) 设为所有者 (Owner)
  5) 返回
请选择: 1

邀请谁？
  1) lisi
  2) wangwu
请选择: 1

  ⏳ 邀请 lisi...
  ✅ lisi 已加入「AI全能群」
```

</details>

<details>
<summary><b>查看运行状态</b></summary>

```bash
openclaw rocketchat status
```

```
=== Rocket.Chat 状态 ===

  服务器:     运行中 - http://123.45.67.89:3000
  MongoDB:    运行中

用户
  zhangsan    lisi 🔒只读

机器人                        Agent           状态
  molty (小龙虾)              main            在线
  work-claw (工作助手)        work            在线

私有频道
  AI全能群     zhangsan(Owner), lisi, molty(Bot), work-claw(Bot)
```

</details>

<details>
<summary><b>卸载</b></summary>

```bash
openclaw rocketchat uninstall
```

</details>

## 命令一览

| 命令 | 说明 |
|---|---|
| `openclaw rocketchat setup` | 连接 Rocket.Chat + 创建管理员 + 创建手机账号 |
| `openclaw rocketchat add-bot` | 添加机器人 + 绑定 Agent + 建立私聊 |
| `openclaw rocketchat add-group` | 创建私有频道（多机器人群组） |
| `openclaw rocketchat add-user` | 添加手机登录用户 |
| `openclaw rocketchat remove-user` | 删除手机登录用户 |
| `openclaw rocketchat invite` | 群组成员管理（邀请/移除/设管理员） |
| `openclaw rocketchat status` | 查看运行状态（含 Agent 健康检查） |
| `openclaw rocketchat uninstall` | 卸载 Rocket.Chat |

所有命令都是**交互式**的——不需要记参数，按提示输入即可。

## 配置示例

所有配置由 CLI 命令自动写入 `openclaw.json`，你不需要手动编辑：

```json5
{
  // Agent 由 openclaw agents add 管理（插件不干预）
  agents: {
    list: [
      { id: "main", default: true },
      { id: "work", name: "工作助手" },
    ],
  },

  // 以下由插件 CLI 命令自动写入
  bindings: [
    { agentId: "main", match: { channel: "rocketchat", accountId: "molty" } },
    { agentId: "work", match: { channel: "rocketchat", accountId: "work-claw" } },
  ],
  channels: {
    rocketchat: {
      enabled: true,
      serverUrl: "http://192.168.1.100:3000",
      accounts: {
        molty: { botUsername: "molty", botDisplayName: "小龙虾" },
        "work-claw": { botUsername: "work-claw", botDisplayName: "工作助手" },
      },
      groups: {
        "AI全能群": { requireMention: false, bots: ["molty", "work-claw"] },
      },
    },
  },
}
```

## 架构

### 方式 A：同机部署

所有组件在同一台服务器上，最简单。

```
┌─────────────────────────────────────────────┐
│              📱 用户手机                      │
│           Rocket.Chat App                    │
└─────────────┬───────────────────────────────┘
              │ HTTP (公网IP:3000)
┌─────────────▼───────────────────────────────┐
│         你的公网服务器（一台机器搞定）          │
│                                              │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │  Rocket.Chat    │  │  OpenClaw Gateway │  │
│  │  (Docker)       │  │                   │  │
│  │                 │◄─┤  @openclaw/       │  │
│  │  ┌───────────┐  │  │  rocketchat       │  │
│  │  │ MongoDB   │  │  │  plugin           │  │
│  │  └───────────┘  │  │                   │  │
│  └─────────────────┘  │  ┌─────────────┐  │  │
│                        │  │ Agent: main │  │  │
│                        │  │ Agent: work │  │  │
│                        │  └─────────────┘  │  │
│                        └──────────────────┘  │
└──────────────────────────────────────────────┘
```

### 方式 B：分离部署

RC 在公网 VPS，OpenClaw 在家庭内网或低配机器。适合没有公网 IP 或内存不足的场景。

```
┌─────────────────────────────────────────────┐
│              📱 用户手机                      │
│           Rocket.Chat App                    │
└─────────────┬───────────────────────────────┘
              │ HTTP (公网IP:3000)
┌─────────────▼───────────────────────────────┐
│       公网 VPS（便宜的小鸡即可，1C1G 够用）    │
│                                              │
│  ┌─────────────────┐                         │
│  │  Rocket.Chat    │  ← 用 install-rc.sh    │
│  │  (Docker)       │    一键安装              │
│  │  ┌───────────┐  │                         │
│  │  │ MongoDB   │  │                         │
│  │  └───────────┘  │                         │
│  └────────▲────────┘                         │
└───────────┼──────────────────────────────────┘
            │ HTTP/WebSocket (公网)
┌───────────┼──────────────────────────────────┐
│       家庭内网 / 本地电脑                      │
│           │                                   │
│  ┌────────┴─────────────────────────────┐    │
│  │  OpenClaw Gateway                     │    │
│  │                                       │    │
│  │  @openclaw/rocketchat plugin          │    │
│  │  （通过公网连接远程 RC）                │    │
│  │                                       │    │
│  │  ┌─────────────┐                      │    │
│  │  │ Agent: main │                      │    │
│  │  │ Agent: work │                      │    │
│  │  └─────────────┘                      │    │
│  └───────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

> 方式 B 中，远程 VPS 上只需运行 `install-rc.sh` 脚本即可安装 Rocket.Chat，然后回到本地 OpenClaw 运行 `openclaw rocketchat setup` 选择"连接远程服务器"。

## 常见问题

<details>
<summary><b>推送通知在国内稳定吗？</b></summary>

App 在前台时走 WebSocket，消息实时送达，零延迟。App 在后台时走 APNs 推送，延迟约 1-5 秒，偶尔可能丢失——和国内大多数 App 的推送表现一致。
</details>

<details>
<summary><b>支持哪些消息格式？</b></summary>

纯文本、Markdown（含代码高亮）、图片、文件、语音消息。Rocket.Chat 原生渲染 Markdown，代码块自带语法高亮。
</details>

<details>
<summary><b>可以多人使用吗？</b></summary>

可以。`openclaw rocketchat add-user` 可以添加多个手机用户（家人、同事）。每个人下载 Rocket.Chat App，用自己的账号登录即可。
</details>

## 技术栈

- **TypeScript** — 与 OpenClaw 生态一致
- **Rocket.Chat REST API** — 用户/群组/消息管理
- **Rocket.Chat WebSocket (DDP)** — 实时消息订阅
- **Docker Compose** — 一键部署 Rocket.Chat + MongoDB
- **Vitest** — 单元测试

## 贡献

欢迎贡献！无论是 Bug 报告、功能建议还是代码贡献：

1. Fork 这个仓库
2. 创建你的分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到远程 (`git push origin feature/amazing`)
5. 创建 Pull Request

## 许可证

[MIT](LICENSE) — 自由使用，自由修改。

---

<div align="center">

**如果这个插件对你有帮助，请给个 Star ⭐**

**每一个 Star 都是对中国开发者的支持 🇨🇳**

[![Star History Chart](https://api.star-history.com/svg?repos=Kxiandaoyan/openclaw-rocketchat&type=Date)](https://star-history.com/#Kxiandaoyan/openclaw-rocketchat&Date)

*让每一个中国用户都能轻松使用 AI 助手*

</div>
