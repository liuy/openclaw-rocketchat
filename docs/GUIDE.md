[首页](../README.md) · [使用指南](GUIDE.md) · [常见问题](FAQ.md) · [配置参数](CONFIGURATION.md) · [架构](ARCHITECTURE.md) · [安全](SECURITY.md)

# 使用指南

## 快速上手详细步骤

### 前置条件

- [OpenClaw](https://docs.openclaw.ai/) 已安装
- 一台有**公网 IP** 的服务器（阿里云、腾讯云、AWS 等均可）
- 防火墙/安全组已放行 **443 端口**（HTTPS）和 **80 端口**（Let's Encrypt 证书验证需要）

### 第一步：部署 Rocket.Chat

在你的服务器上运行一键安装脚本（本地或远程 VPS 都是同一条命令）：

```bash
bash install-rc.sh
```

或者远程一键安装（不用提前下载脚本）：

```bash
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
```

脚本会自动完成以下工作：
- 检测并安装 Docker（如果没有）
- 部署 Rocket.Chat + MongoDB + Nginx（全部 Docker 容器）
- 通过 [sslip.io](https://sslip.io) 自动获取**免费域名**（如 `166-88-11-59.sslip.io`，无需购买）
- 通过 acme.sh 自动获取 **Let's Encrypt 正式 HTTPS 证书**（双重验证策略：HTTP-01 + TLS-ALPN-01，App 直连零警告，自动续期）
- 禁用邮箱二次验证（自建服务器无邮件服务）
- Rocket.Chat 仅内部通信，**不暴露 3000 端口到公网**

你会看到：

```
╔══════════════════════════════════════════════════════╗
║   Rocket.Chat 一键安装（HTTPS + OpenClaw 专用）       ║
╚══════════════════════════════════════════════════════╝

  ⏳ 检测 Docker...
  ✅ Docker 已安装 (v29.2.1)
  ✅ Docker Compose 已安装 (v5.0.2)
  ✅ 端口 443 可用
  ⏳ 获取服务器公网 IP...
  ✅ 公网 IP: 123.45.67.89
  ℹ 域名: 123-45-67-89.sslip.io（通过 sslip.io 免费提供）
  ⏳ 尝试获取 Let's Encrypt 免费证书...
  ✅ Let's Encrypt 证书获取成功！（自动续期）
  ⏳ 生成 Nginx 配置...
  ✅ Nginx 配置已生成
  ⏳ 生成 docker-compose.yml...
  ✅ 配置文件已生成
  ⏳ 拉取镜像并启动容器（首次约 2-5 分钟）...
  ✅ Rocket.Chat 已就绪！

╔══════════════════════════════════════════════════════════╗
║              🎉 Rocket.Chat 安装完成！                    ║
╚══════════════════════════════════════════════════════════╝

  服务器地址: https://123-45-67-89.sslip.io
  HTTPS:      Let's Encrypt 正式证书（acme.sh 自动续期）
  域名:       123-45-67-89.sslip.io（由 sslip.io 免费提供，无需购买）

  🔑 管理员账号（已自动生成强密码）：
     用户名: admin
     密码:   Kx8mVp2dRfT7nQwL3s9A
   （已保存到 ~/rocketchat/.rc-info，setup 时会自动读取。
    普通用户不需要知道这个账号，仅供服务器管理使用。）

  安装信息已保存到: ~/rocketchat/.rc-info

  📌 接下来的步骤：
     1️⃣  确保防火墙已放行端口 443 和 80
     2️⃣  安装插件并配置：
         openclaw plugins install openclaw-rocketchat
         openclaw rocketchat setup
         💡 如果在同一台机器上，setup 会自动读取安装信息，无需手动输入！
     3️⃣  添加 AI 机器人：
         openclaw rocketchat add-bot
```

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

  ✅ 检测到本机 Rocket.Chat 安装信息
    服务器地址: https://123-45-67-89.sslip.io
    域名: 123-45-67-89.sslip.io
    管理员: admin

  使用检测到的信息自动配置？（推荐）(Y/n): Y

  使用检测到的服务器地址: https://123-45-67-89.sslip.io
  ⏳ 测试连接 https://123-45-67-89.sslip.io ...
  ✅ 连接成功！Rocket.Chat 版本: 8.1.0

  ⏳ 创建管理员（内部使用，你不需要记住）...
  已将默认管理员密码修改为强随机密码（安全）
  已自动关闭公开注册（安全）
  ✅ 管理员已就绪

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
     2. 打开 App，服务器填: https://123-45-67-89.sslip.io
     3. 用户名: zhangsan
     4. 密码: 你设置的密码

  💡 关于 App 中可能看到的 admin 或 rc-admin 用户：
     这是 Rocket.Chat 的内部管理员账号，由 setup 自动创建/接管，
     用于管理机器人和用户。你无需理会，也不要删除它。

  🔥 重要：请确保服务器防火墙已放行端口 443 和 80

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

  📱 打开 Rocket.Chat App 和机器人聊天：
     如果会话列表中没有看到 小龙虾，点左上角「搜索」图标，
     输入「molty」即可找到并开始私聊。
```

**输入机器人名字、选一个 Agent 编号，就完事了。**

### 第四步：手机下载 Rocket.Chat，开聊

1. 下载 Rocket.Chat App
   - **iPhone**：App Store 搜索 **"Rocket.Chat"**
   - **Android**：Google Play 搜索 **"Rocket.Chat"**，或从 [官网](https://www.rocket.chat/download-apps) 下载 APK
   - **电脑**：[官网下载桌面客户端](https://www.rocket.chat/download-apps)，或直接浏览器访问服务器地址
2. 打开 App，点击 **"Add Server"**，输入 install-rc.sh 输出的服务器地址（如 `https://123-45-67-89.sslip.io`）
3. 用第二步设置的用户名和密码登录
4. 如果会话列表中没看到机器人，点左上角「搜索」图标，输入机器人用户名即可找到并开聊！

**到这里就全部完成了。总共 3 条命令 + 手机下载 App。**

---

## 远程安装 Rocket.Chat（分离部署模式）

如果你选择方式 B（分离部署），在远程 VPS 上执行：

```bash
# SSH 登录你的 VPS 后，一键安装：
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
```

脚本会自动：
- 检测并安装 Docker（如未安装）
- 部署 Rocket.Chat + MongoDB + Nginx（HTTPS）
- 通过 sslip.io 获取免费域名 + acme.sh 申请 Let's Encrypt 正式证书
- 启动服务并等待就绪
- 输出 `https://VPS-IP.sslip.io` 地址和后续步骤

安装完成后，回到你的 OpenClaw 机器运行 `openclaw rocketchat setup`，输入脚本输出的 `https://xxx.sslip.io` 地址即可。

---

## 创建多机器人群组

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

---

## 添加更多手机用户（家人、同事）

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
     登录: https://123-45-67-89.sslip.io / 用户名: lisi

  📱 告诉 lisi 下载 Rocket.Chat App，服务器填 https://123-45-67-89.sslip.io
     用上面的用户名密码登录后，即可：
     - 在「AI全能群」里和团队一起跟 AI 讨论
     - 直接私聊任意机器人，进行一对一 AI 对话
```

> **只读模式** 适合老板查看进度、审计、旁听等场景。只读用户可以看到所有群聊内容，但不能发消息也不能私聊机器人。

---

## 删除用户

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

---

## 群组成员管理

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

---

## 查看运行状态

```bash
openclaw rocketchat status
```

```
=== Rocket.Chat 状态 ===

  服务器:     运行中 - https://123-45-67-89.sslip.io
  MongoDB:    运行中

用户
  zhangsan    lisi 🔒只读

机器人                        Agent           状态
  molty (小龙虾)              main            在线
  work-claw (工作助手)        work            在线

私有频道
  AI全能群     zhangsan(Owner), lisi, molty(Bot), work-claw(Bot)
```

---

## 升级插件

```bash
openclaw rocketchat upgrade
```

一键完成：显示版本对比 → 备份配置 → 停 Gateway → 删旧版 → 安装新版 → 恢复配置。
全程自动，**不会丢失机器人、群组、绑定等任何配置**。

---

## 卸载

```bash
openclaw rocketchat uninstall
```

交互式引导，可选择是否同时清理 Docker 容器和数据。
