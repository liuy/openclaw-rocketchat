[首页](../README.md) · [使用指南](GUIDE.md) · [常见问题](FAQ.md) · [配置参数](CONFIGURATION.md) · [架构](ARCHITECTURE.md) · [安全](SECURITY.md) · [多 Agent](MULTI-AGENT.md) · [多渠道](MULTI-CHANNEL.md) · [命令](COMMANDS.md)

# 常见问题

## setup 提示"注册已被禁用"怎么办？

这说明之前已经运行过 setup 并自动关闭了公开注册。解决方案：

**方案 1：重置 Rocket.Chat（推荐，最干净）**

```bash
cd ~/rocketchat && docker compose down -v
curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
openclaw rocketchat setup
openclaw rocketchat add-bot
```

**方案 2：用已有管理员登录**

如果你知道管理员的用户名密码，重新运行 setup 时选择「使用已有管理员账号」。

## 如何升级插件？

```bash
openclaw rocketchat upgrade
```

一条命令搞定。自动备份配置 → 安装新版 → 恢复配置，**不会丢失任何机器人、群组、绑定配置**。

## 想彻底重来（从头配置）怎么办？

> 完整重置步骤也可参阅 [CONFIGURATION.md — 完全重置](CONFIGURATION.md#完全重置-rocketchat-配置)

```bash
# 1. 清理配置文件中的所有 Rocket.Chat 相关条目（必须在停止 Gateway 之前执行，否则 Gateway 可能因配置异常无法正常停止）
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

# 2. 停止 Gateway
openclaw gateway stop

# 3.（可选）如果也想重置 Rocket.Chat 数据（彻底删除容器、数据和安装目录）：
# cd ~/rocketchat && docker compose down -v && cd ~ && rm -rf ~/rocketchat

# 4. 清除插件和凭据
rm -rf ~/.openclaw/extensions/openclaw-rocketchat
rm -rf ~/.openclaw/credentials/rocketchat*

# 5. 重新安装（如果第 3 步重置了 RC，先重新跑 install-rc.sh）
openclaw plugins install openclaw-rocketchat
openclaw rocketchat setup
openclaw rocketchat add-bot
openclaw gateway start
```

## Rocket.Chat 常用 Docker 管理命令

```bash
# 查看容器状态
docker ps

# 查看日志
cd ~/rocketchat && docker compose logs -f

# 停止服务
cd ~/rocketchat && docker compose stop

# 启动服务
cd ~/rocketchat && docker compose start

# 重启服务
cd ~/rocketchat && docker compose restart

# 完全卸载（删除所有数据）
cd ~/rocketchat && docker compose down -v
```

## sslip.io 是什么？为什么不需要买域名？

[sslip.io](https://sslip.io) 是一个免费的通配符 DNS 服务。它把 IP 地址嵌入域名中，自动解析回该 IP：

- `166-88-11-59.sslip.io` → 解析到 `166.88.11.59`

这样你就有了一个"域名"，可以配合 Let's Encrypt 获取**正式的 HTTPS 证书**，手机 App 直连零警告。

- 完全免费，无需注册，无需配置
- 由开源社区维护，Google、IBM 等文档中也在使用
- 如果 sslip.io 不可用（极罕见），脚本会给出明确提示

## 证书获取失败怎么办？

install-rc.sh 通过 acme.sh 自动获取 Let's Encrypt 证书，采用**双重验证策略**：

1. **策略 1：HTTP-01**（端口 80）— 最通用的方式，优先尝试
2. **策略 2：TLS-ALPN-01**（端口 443）— 80 端口不可用时自动切换

如果两种方式都失败，脚本会给出详细错误原因。常见原因：

1. **防火墙未放行端口** — 至少需要放行 443，建议同时放行 80。在云控制台的安全组中添加对应规则。
2. **端口被其他程序占用** — 用 `ss -tlnp | grep -E ':80 |:443 '` 检查，停止占用程序后重试。
3. **sslip.io DNS 解析异常** — 用 `dig 你的域名.sslip.io` 检查解析是否正确。
4. **Let's Encrypt 速率限制** — 短时间内多次失败可能触发限制，等待 1 小时后重试。

修复后运行 `bash install-rc.sh --force` 重新安装。

## 推送通知在国内稳定吗？

App 在前台时走 WebSocket，消息实时送达，零延迟。App 在后台时走 APNs 推送，延迟约 1-5 秒，偶尔可能丢失——和国内大多数 App 的推送表现一致。

## 支持哪些消息格式？

纯文本、Markdown（含代码高亮）、图片、文件、语音消息。Rocket.Chat 原生渲染 Markdown，代码块自带语法高亮。

## 可以多人使用吗？

可以。`openclaw rocketchat add-user` 可以添加多个手机用户（家人、同事）。每个人下载 Rocket.Chat App，用自己的账号登录即可。

详细步骤请参阅 [使用指南 — 添加更多手机用户](GUIDE.md#添加更多手机用户家人同事)。

## 代码在 Rocket.Chat App 里的显示效果

AI 回复中的代码块在 Rocket.Chat App 里会**自动语法高亮、格式化展示**，不像微信/钉钉等 App 把代码挤成一团。技术人员的使用体验远超其他聊天工具。
