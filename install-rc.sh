#!/usr/bin/env bash
# ==============================================================
# Rocket.Chat 一键安装脚本
# 在任意 Linux/macOS 上快速部署 Rocket.Chat + MongoDB（Docker）
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
#   curl -fsSL https://raw.githubusercontent.com/Kxiandaoyan/openclaw-rocketchat/main/install-rc.sh | bash
#   或指定端口：
#   RC_PORT=4000 bash install-rc.sh
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
RC_PORT="${RC_PORT:-3000}"
INSTALL_DIR="${RC_INSTALL_DIR:-$HOME/rocketchat}"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Rocket.Chat 一键安装（OpenClaw 远程部署专用）     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
info "端口: ${RC_PORT}"
info "安装目录: ${INSTALL_DIR}"
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

    info "服务器地址: http://${PUBLIC_IP}:${RC_PORT}"
    echo ""
    info "如果需要重新安装，请先运行："
    info "  cd ${INSTALL_DIR} && ${COMPOSE_CMD_CHECK} down -v"
    info "  rm -rf ${INSTALL_DIR}"
    info "然后重新运行本脚本。"
    echo ""
    info "如果只是要配置 OpenClaw 插件，直接运行："
    info "  openclaw rocketchat setup"
    exit 0
  else
    warn "容器未运行，尝试重新启动..."
    if cd "${INSTALL_DIR}" && ${COMPOSE_CMD_CHECK} up -d 2>/dev/null; then
      success "已重新启动！"
      info "等待服务就绪后运行: openclaw rocketchat setup"
      # 继续到等待就绪阶段
      COMPOSE_CMD="${COMPOSE_CMD_CHECK}"

      # 跳过安装步骤，直接等待就绪
      SKIP_TO_WAIT=true
    else
      warn "启动失败，将重新安装..."
    fi
  fi
fi

# 如果是重启已有安装，跳到等待就绪
if [[ "${SKIP_TO_WAIT:-}" == "true" ]]; then
  # 直接跳到等待就绪（步骤 6）
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
    
    # 将当前用户加入 docker 组
    if [[ "$(id -u)" -ne 0 ]]; then
      sudo usermod -aG docker "$USER"
      info "已将 $USER 加入 docker 组"
      info "如果后续 docker 命令报权限错误，请注销后重新登录"
    fi

    # 启动 docker 服务
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
  # 旧版独立 docker-compose
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

# 确定 compose 命令
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

# -----------------------------------------------
# 3. 检测端口
# -----------------------------------------------
step "检测端口 ${RC_PORT}..."

if command -v ss &>/dev/null; then
  if ss -tlnp 2>/dev/null | grep -q ":${RC_PORT} "; then
    warn "端口 ${RC_PORT} 已被占用！"
    info "如果是已有的 Rocket.Chat 实例，可以直接使用。"
    info "否则请设置 RC_PORT 环境变量使用其他端口："
    info "  RC_PORT=4000 bash install-rc.sh"
    read -p "继续安装吗？[y/N]: " -r
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
      info "已取消。"
      exit 0
    fi
  else
    success "端口 ${RC_PORT} 可用"
  fi
elif command -v lsof &>/dev/null; then
  if lsof -i ":${RC_PORT}" &>/dev/null; then
    warn "端口 ${RC_PORT} 可能被占用！"
  else
    success "端口 ${RC_PORT} 可用"
  fi
else
  info "无法检测端口状态，跳过检测"
fi

# -----------------------------------------------
# 4. 生成 Docker Compose 配置
# -----------------------------------------------
step "创建安装目录 ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"

step "生成 docker-compose.yml..."
cat > "${INSTALL_DIR}/docker-compose.yml" << 'COMPOSE_EOF'
# Auto-generated by install-rc.sh (OpenClaw Rocket.Chat plugin)
# Do not edit manually unless you know what you're doing

services:
  rocketchat:
    image: registry.rocket.chat/rocketchat/rocket.chat:latest
    restart: unless-stopped
    ports:
      - "${RC_PORT:-3000}:3000"
    environment:
      MONGO_URL: "mongodb://mongodb:27017/rocketchat?replicaSet=rs0"
      ROOT_URL: "http://localhost:${RC_PORT:-3000}"
      PORT: 3000
      DEPLOY_METHOD: docker
      OVERWRITE_SETTING_Show_Setup_Wizard: "completed"
      OVERWRITE_SETTING_Accounts_RegistrationForm: "Disabled"
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
        mongod --replSet $$MONGODB_REPLICA_SET_NAME --bind_ip_all &
        sleep 2;
        until mongosh --eval \"db.adminCommand('ping')\"; do
          echo 'Waiting for MongoDB...';
          sleep 1;
        done;
        mongosh --eval \"rs.initiate({_id: '$$MONGODB_REPLICA_SET_NAME', members: [{ _id: 0, host: '$$MONGODB_INITIAL_PRIMARY_HOST:$$MONGODB_PORT_NUMBER' }]})\";
        echo 'ReplicaSet initiated';
        wait"

volumes:
  mongodb_data:
COMPOSE_EOF

# 写入 .env
echo "RC_PORT=${RC_PORT}" > "${INSTALL_DIR}/.env"

success "配置文件已生成"

# -----------------------------------------------
# 5. 拉取镜像并启动
# -----------------------------------------------
step "拉取镜像并启动容器（首次约 2-5 分钟）..."
cd "${INSTALL_DIR}"
${COMPOSE_CMD} pull --quiet 2>/dev/null || ${COMPOSE_CMD} pull
${COMPOSE_CMD} up -d

fi  # end SKIP_TO_WAIT else block

# -----------------------------------------------
# 6. 等待就绪
# -----------------------------------------------
step "等待 Rocket.Chat 启动..."

MAX_WAIT=180
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
  # 尝试访问 /api/v1/info
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${RC_PORT}/api/v1/info" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ]; then
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
  info "可以手动检查: curl http://127.0.0.1:${RC_PORT}/api/v1/info"
  info "或查看日志: cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f rocketchat"
fi

# -----------------------------------------------
# 7. 获取公网 IP
# -----------------------------------------------
step "获取服务器公网 IP..."

PUBLIC_IP=""
# 尝试多个 IP 查询服务
for url in "https://ifconfig.me" "https://api.ipify.org" "https://icanhazip.com"; do
  PUBLIC_IP=$(curl -s --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]')
  if [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    break
  fi
  PUBLIC_IP=""
done

if [ -z "$PUBLIC_IP" ]; then
  warn "无法自动获取公网 IP"
  PUBLIC_IP="<你的公网IP>"
fi

# -----------------------------------------------
# 8. 完成
# -----------------------------------------------
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              🎉 Rocket.Chat 安装完成！                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
info "服务器地址: http://${PUBLIC_IP}:${RC_PORT}"
info "安装目录:   ${INSTALL_DIR}"
echo ""
info "📌 接下来的步骤："
echo ""
info "  1️⃣  确保防火墙已放行端口 ${RC_PORT}"
info "     阿里云: 安全组 → 添加 TCP ${RC_PORT}"
info "     腾讯云: 防火墙 → 添加 TCP ${RC_PORT}"
info "     Ubuntu: sudo ufw allow ${RC_PORT}/tcp"
info "     CentOS: sudo firewall-cmd --add-port=${RC_PORT}/tcp --permanent && sudo firewall-cmd --reload"
echo ""
info "  2️⃣  回到你的 OpenClaw 机器，运行："
echo ""
echo -e "     ${CYAN}openclaw rocketchat setup${NC}"
echo ""
info "     选择「连接远程服务器」，输入地址："
echo -e "     ${GREEN}http://${PUBLIC_IP}:${RC_PORT}${NC}"
echo ""
info "🔧 常用管理命令："
info "  查看日志:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
info "  停止服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} stop"
info "  启动服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} start"
info "  重启服务:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} restart"
info "  完全卸载:   cd ${INSTALL_DIR} && ${COMPOSE_CMD} down -v"
echo ""
