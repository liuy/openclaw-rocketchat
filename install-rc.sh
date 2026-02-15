#!/usr/bin/env bash
# ==============================================================
# Rocket.Chat 一键安装脚本（含 HTTPS）
# 在任意 Linux/macOS 上快速部署 Rocket.Chat + MongoDB + Nginx（Docker）
#
# 自动配置：
#   - Nginx 反向代理（HTTPS 443 端口，自签名证书）
#   - Rocket.Chat 仅内部通信，不暴露到公网
#   - 禁用邮箱二次验证（自建服务器无邮件服务）
#
# 适用于所有场景：
#   - 本地部署：在 OpenClaw 同一台机器上运行
#   - 远程部署：在公网 VPS 上运行，OpenClaw 在另一台机器
#
# 部署完成后运行 openclaw rocketchat setup 连接并配置
#
# 用法：
#   bash install-rc.sh
#   或远程一键安装：
#   curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/master/install-rc.sh | bash
#   强制重装（跳过已安装检测）：
#   bash install-rc.sh --force
# ==============================================================

set -euo pipefail

# 解析参数
FORCE_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE_INSTALL=true ;;
  esac
done

# -----------------------------------------------
# 配色
# -----------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
success() { echo -e "${GREEN}✅ ${NC}$1"; }
warn()    { echo -e "${YELLOW}⚠️  ${NC}$1"; }
err()     { echo -e "${RED}❌ ${NC}$1"; }
step()    { echo -e "${CYAN}⏳ ${NC}$1"; }

# -----------------------------------------------
# 参数
# -----------------------------------------------
INSTALL_DIR="${RC_INSTALL_DIR:-$HOME/rocketchat}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Rocket.Chat 一键安装（HTTPS + OpenClaw 专用）       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
info "安装目录: ${INSTALL_DIR}"
info "对外端口: 443 (HTTPS)"
echo ""

# -----------------------------------------------
# 0. 检测是否已安装
# -----------------------------------------------
if [[ "${FORCE_INSTALL}" == "true" ]]; then
  warn "强制安装模式，跳过已安装检测"
elif [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
  warn "检测到已有 Rocket.Chat 安装（${INSTALL_DIR}）"
  echo ""

  # 检查容器是否正在运行
  COMPOSE_CMD_CHECK="docker compose"
  if ! docker compose version &>/dev/null; then
    COMPOSE_CMD_CHECK="docker-compose"
  fi

  if cd "${INSTALL_DIR}" && ${COMPOSE_CMD_CHECK} ps --format '{{.State}}' 2>/dev/null | grep -qi "running"; then
    success "Rocket.Chat 正在运行中！"

    # 尝试获取公网 IP
    PUBLIC_IP=""
    for url in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
      PUBLIC_IP=$(curl -s --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]')
      if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        break
      fi
      PUBLIC_IP=""
    done
    [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="<你的公网IP>"

    RC_DOMAIN="${PUBLIC_IP//./-}.sslip.io"
    info "服务器地址: https://${RC_DOMAIN}"
    echo ""
    info "如果需要重新安装，请先运行："
    info "  cd ${INSTALL_DIR} && ${COMPOSE_CMD_CHECK} down -v"
    info "  rm -rf ${INSTALL_DIR}"
    info "然后重新运行本脚本。"
    echo ""
    info "如果只是要配置 OpenClaw 插件，运行："
    info "  openclaw plugins install openclaw-rocketchat"
    info "  openclaw rocketchat setup"
    exit 0
  else
    warn "容器未运行，尝试重新启动..."
    if cd "${INSTALL_DIR}" && ${COMPOSE_CMD_CHECK} up -d 2>/dev/null; then
      success "已重新启动！"
      info "等待服务就绪后运行: openclaw rocketchat setup"
      COMPOSE_CMD="${COMPOSE_CMD_CHECK}"
      SKIP_TO_WAIT=true
    else
      warn "启动失败，将重新安装..."
    fi
  fi
fi

# 如果是重启已有安装，跳到等待就绪
if [[ "${SKIP_TO_WAIT:-}" == "true" ]]; then
  :
else
# -----------------------------------------------
# 1. 检测操作系统
# -----------------------------------------------
OS="$(uname -s)"
if [[ "$OS" != "Linux" && "$OS" != "Darwin" ]]; then
  err "此脚本仅支持 Linux 和 macOS！"
  exit 1
fi

# -----------------------------------------------
# 2. 检测 / 安装 Docker
# -----------------------------------------------
step "检测 Docker..."

if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "unknown")
  success "Docker 已安装 (v${DOCKER_VERSION})"
else
  warn "未检测到 Docker！"
  echo ""

  if [[ "$OS" == "Linux" ]]; then
    info "正在自动安装 Docker..."
    step "运行官方安装脚本（可能需要 sudo 密码）..."
    curl -fsSL https://get.docker.com | sh
    
    if [[ "$(id -u)" -ne 0 ]]; then
      sudo usermod -aG docker "$USER"
      info "已将 $USER 加入 docker 组"
      info "如果后续 docker 命令报权限错误，请注销后重新登录"
    fi

    sudo systemctl enable --now docker 2>/dev/null || true
    success "Docker 安装完成！"
  elif [[ "$OS" == "Darwin" ]]; then
    err "macOS 请手动安装 Docker Desktop:"
    info "  下载地址: https://www.docker.com/products/docker-desktop/"
    info "  安装后启动 Docker Desktop，然后重新运行此脚本"
    exit 1
  fi
fi

# 验证 Docker Compose
step "检测 Docker Compose..."
if docker compose version &>/dev/null; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  success "Docker Compose 已安装 (v${COMPOSE_VERSION})"
elif docker-compose version &>/dev/null; then
  COMPOSE_VERSION=$(docker-compose version --short 2>/dev/null || echo "unknown")
  success "Docker Compose 已安装 (v${COMPOSE_VERSION})"
  COMPOSE_CMD="docker-compose"
else
  err "未检测到 Docker Compose！"
  if [[ "$OS" == "Linux" ]]; then
    info "尝试安装 docker-compose-plugin..."
    sudo apt-get update -qq && sudo apt-get install -y -qq docker-compose-plugin 2>/dev/null \
      || sudo yum install -y docker-compose-plugin 2>/dev/null \
      || { err "自动安装失败，请手动安装: https://docs.docker.com/compose/install/"; exit 1; }
    success "Docker Compose 安装完成！"
  else
    err "请安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
  fi
fi

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

# -----------------------------------------------
# 3. 检测端口 443
# -----------------------------------------------
step "检测端口 443..."

if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ":443 "; then
    warn "端口 443 已被占用！"
    info "请检查是否有其他 Web 服务（如 Apache、Nginx）正在运行。"
    info "可以运行 'ss -tlnp | grep :443' 查看占用进程。"
    read -p "继续安装吗？[y/N]: " -r
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
      info "已取消。"
      exit 0
    fi
  else
    success "端口 443 可用"
  fi
elif command -v lsof &>/dev/null; then
  if lsof -i ":443" &>/dev/null; then
    warn "端口 443 可能被占用！"
  else
    success "端口 443 可用"
  fi
else
  info "无法检测端口状态，跳过检测"
fi

# -----------------------------------------------
# 4. 获取公网 IP
# -----------------------------------------------
step "获取服务器公网 IP..."

PUBLIC_IP=""
for url in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
  PUBLIC_IP=$(curl -s --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]')
  if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    break
  fi
  PUBLIC_IP=""
done

if [ -z "$PUBLIC_IP" ]; then
  warn "无法自动获取公网 IP"
  read -p "请手动输入服务器公网 IP: " PUBLIC_IP
  if [ -z "$PUBLIC_IP" ]; then
    err "公网 IP 不能为空！"
    exit 1
  fi
fi

success "公网 IP: ${PUBLIC_IP}"

# 生成 sslip.io 域名（免费，无需购买域名）
# 例如 166.88.11.59 -> 166-88-11-59.sslip.io
RC_DOMAIN="${PUBLIC_IP//./-}.sslip.io"
info "域名: ${RC_DOMAIN}（通过 sslip.io 免费提供）"

# -----------------------------------------------
# 5. 获取 SSL 证书（Let's Encrypt 优先，自签名兜底）
# -----------------------------------------------
SSL_DIR="${INSTALL_DIR}/ssl"
mkdir -p "${SSL_DIR}"
USE_LETSENCRYPT=false

step "尝试获取 Let's Encrypt 免费证书..."
info "（需要 80 端口可用，如果失败会自动使用自签名证书）"

# 检查 80 端口是否可用（certbot 需要）
PORT80_FREE=true
if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ":80 "; then
    PORT80_FREE=false
  fi
fi

if [[ "$PORT80_FREE" == "true" ]]; then
  # 安装 certbot（如果没有）
  if ! command -v certbot &>/dev/null; then
    step "安装 certbot..."
    if command -v apt-get &>/dev/null; then
      apt-get update -qq && apt-get install -y -qq certbot 2>/dev/null
    elif command -v yum &>/dev/null; then
      yum install -y certbot 2>/dev/null
    fi
  fi

  if command -v certbot &>/dev/null; then
    # 用 standalone 模式获取证书
    if certbot certonly --standalone --non-interactive --agree-tos \
      --register-unsafely-without-email \
      -d "${RC_DOMAIN}" 2>/dev/null; then
      # 复制证书到安装目录
      cp "/etc/letsencrypt/live/${RC_DOMAIN}/fullchain.pem" "${SSL_DIR}/rocketchat.crt"
      cp "/etc/letsencrypt/live/${RC_DOMAIN}/privkey.pem" "${SSL_DIR}/rocketchat.key"
      USE_LETSENCRYPT=true
      success "Let's Encrypt 证书获取成功！（自动续期）"

      # 设置自动续期 cron
      RENEW_CMD="certbot renew --quiet && cp /etc/letsencrypt/live/${RC_DOMAIN}/fullchain.pem ${SSL_DIR}/rocketchat.crt && cp /etc/letsencrypt/live/${RC_DOMAIN}/privkey.pem ${SSL_DIR}/rocketchat.key && cd ${INSTALL_DIR} && ${COMPOSE_CMD} restart nginx"
      (crontab -l 2>/dev/null; echo "0 3 * * * ${RENEW_CMD}") | sort -u | crontab -
      info "已设置证书自动续期（每天凌晨 3 点检查）"
    else
      warn "Let's Encrypt 证书获取失败，使用自签名证书"
    fi
  else
    warn "certbot 未安装成功，使用自签名证书"
  fi
else
  warn "80 端口被占用，跳过 Let's Encrypt，使用自签名证书"
fi

# 如果 Let's Encrypt 失败，使用自签名证书
if [[ "$USE_LETSENCRYPT" != "true" ]]; then
  step "生成 HTTPS 自签名证书..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/rocketchat.key" \
    -out "${SSL_DIR}/rocketchat.crt" \
    -subj "/CN=${RC_DOMAIN}" \
    -addext "subjectAltName=DNS:${RC_DOMAIN},IP:${PUBLIC_IP}" \
    2>/dev/null
  success "自签名证书已生成（有效期 10 年）"
  info "注意：App 首次连接可能需要信任证书"
fi

# -----------------------------------------------
# 6. 生成 Nginx 配置
# -----------------------------------------------
step "生成 Nginx 配置..."

mkdir -p "${INSTALL_DIR}"

cat > "${INSTALL_DIR}/nginx.conf" << 'NGINX_EOF'
server {
    listen 443 ssl;
    server_name _;
    client_max_body_size 200M;

    ssl_certificate /etc/nginx/ssl/rocketchat.crt;
    ssl_certificate_key /etc/nginx/ssl/rocketchat.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://rocketchat:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
NGINX_EOF

success "Nginx 配置已生成"

# -----------------------------------------------
# 7. 生成 Docker Compose 配置
# -----------------------------------------------
step "生成 docker-compose.yml..."

cat > "${INSTALL_DIR}/docker-compose.yml" << COMPOSE_EOF
# Auto-generated by install-rc.sh (OpenClaw Rocket.Chat plugin)
# Rocket.Chat + MongoDB + Nginx (HTTPS)

services:
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - rocketchat

  rocketchat:
    image: registry.rocket.chat/rocketchat/rocket.chat:latest
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      MONGO_URL: "mongodb://mongodb:27017/rocketchat?replicaSet=rs0"
      ROOT_URL: "https://${RC_DOMAIN}"
      PORT: 3000
      DEPLOY_METHOD: docker
      OVERWRITE_SETTING_Show_Setup_Wizard: "completed"
      OVERWRITE_SETTING_Accounts_TwoFactorAuthentication_By_Email_Enabled: "false"
    depends_on:
      - mongodb

  mongodb:
    image: mongodb/mongodb-community-server:8.2-ubi8
    restart: on-failure
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGODB_REPLICA_SET_NAME: rs0
      MONGODB_PORT_NUMBER: 27017
      MONGODB_INITIAL_PRIMARY_HOST: mongodb
    entrypoint: >
      bash -c "
        mongod --replSet \\\$\$MONGODB_REPLICA_SET_NAME --bind_ip_all &
        sleep 2;
        until mongosh --eval \"db.adminCommand('ping')\"; do
          echo 'Waiting for MongoDB...';
          sleep 1;
        done;
        mongosh --eval \"rs.initiate({_id: '\\\$\$MONGODB_REPLICA_SET_NAME', members: [{ _id: 0, host: '\\\$\$MONGODB_INITIAL_PRIMARY_HOST:\\\$\$MONGODB_PORT_NUMBER' }]})\";
        echo 'ReplicaSet initiated';
        wait"

volumes:
  mongodb_data:
COMPOSE_EOF

success "配置文件已生成"

# -----------------------------------------------
# 8. 拉取镜像并启动
# -----------------------------------------------
step "拉取镜像并启动容器（首次约 2-5 分钟）..."
cd "${INSTALL_DIR}"
${COMPOSE_CMD} pull --quiet 2>/dev/null || ${COMPOSE_CMD} pull
${COMPOSE_CMD} up -d

fi  # end SKIP_TO_WAIT else block

# -----------------------------------------------
# 9. 等待就绪
# -----------------------------------------------
step "等待 Rocket.Chat 启动..."

MAX_WAIT=180
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
  # 通过 nginx 的 HTTPS 端口探测（-k 忽略自签名证书）
  HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
    -X POST "https://127.0.0.1/api/v1/login" \
    -H "Content-Type: application/json" \
    -d '{"user":"","password":""}' 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    success "Rocket.Chat 已就绪！"
    break
  fi
  
  WAITED=$((WAITED + INTERVAL))
  if [ $WAITED -lt $MAX_WAIT ]; then
    step "等待中... (${WAITED}s/${MAX_WAIT}s)"
    sleep $INTERVAL
  fi
done

if [ $WAITED -ge $MAX_WAIT ]; then
  warn "等待超时，Rocket.Chat 可能还在启动中。"
  info "可以手动检查: curl -sk https://127.0.0.1/ | head -1"
  info "或查看日志: cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
fi

# -----------------------------------------------
# 10. 获取公网 IP（如果之前没获取到）
# -----------------------------------------------
if [ -z "${PUBLIC_IP:-}" ] || [ "${PUBLIC_IP}" = "<你的公网IP>" ]; then
  step "获取服务器公网 IP..."
  for url in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
    PUBLIC_IP=$(curl -s --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]')
    if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      break
    fi
    PUBLIC_IP=""
  done
  [[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="<你的公网IP>"
fi

# -----------------------------------------------
# 11. 完成
# -----------------------------------------------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              🎉 Rocket.Chat 安装完成！                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "服务器地址: https://${RC_DOMAIN}"
info "安装目录:   ${INSTALL_DIR}"
if [[ "$USE_LETSENCRYPT" == "true" ]]; then
  info "HTTPS:      Let's Encrypt 正式证书（自动续期）"
else
  info "HTTPS:      自签名证书（App 首次连接时信任即可）"
fi
info "域名:       ${RC_DOMAIN}（由 sslip.io 免费提供，无需购买）"
echo ""
info "📌 接下来的步骤："
echo ""
info "  1️⃣  确保防火墙已放行端口 443"
info "     阿里云: 安全组 → 添加 TCP 443"
info "     腾讯云: 防火墙 → 添加 TCP 443"
info "     Ubuntu: sudo ufw allow 443/tcp"
info "     CentOS: sudo firewall-cmd --add-port=443/tcp --permanent && sudo firewall-cmd --reload"
echo ""
info "  2️⃣  回到你的 OpenClaw 机器，安装插件并配置："
echo ""
echo -e "     ${CYAN}openclaw plugins install openclaw-rocketchat${NC}"
echo -e "     ${CYAN}openclaw rocketchat setup${NC}"
echo ""
info "     setup 时输入服务器地址："
echo -e "     ${GREEN}https://${RC_DOMAIN}${NC}"
echo ""
info "  3️⃣  添加 AI 机器人："
echo ""
echo -e "     ${CYAN}openclaw rocketchat add-bot${NC}"
echo ""
info "  4️⃣  手机下载 Rocket.Chat App："
info "     App 里输入服务器地址: https://${RC_DOMAIN}"
if [[ "$USE_LETSENCRYPT" == "true" ]]; then
  info "     证书已受信任，直接连接即可"
else
  info "     首次连接会提示证书不受信任，点「信任」或「继续」即可"
fi
echo ""
info "🔧 常用管理命令："
info "  查看日志:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
info "  停止服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} stop"
info "  启动服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} start"
info "  重启服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} restart"
info "  完全卸载:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} down -v"
echo ""
