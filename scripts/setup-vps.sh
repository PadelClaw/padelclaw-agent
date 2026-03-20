#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bitte als root ausfuehren."
  exit 1
fi

DEPLOY_USER="padelclaw"
DEPLOY_GROUP="docker"
APP_ROOT="/opt/padelclaw"
APP_REPO_DIR="${APP_ROOT}/app"
BACKUP_DIR="${APP_ROOT}/backups"
ENV_FILE="${APP_ROOT}/.env.prod"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release \
  software-properties-common \
  ufw

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker

curl -fsSL https://tailscale.com/install.sh | sh
systemctl enable tailscaled
systemctl start tailscaled

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi

usermod -aG "${DEPLOY_GROUP}" "${DEPLOY_USER}"

install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_ROOT}"
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${APP_REPO_DIR}"
install -d -m 0755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${BACKUP_DIR}"

if [[ -f /root/.ssh/authorized_keys ]]; then
  install -d -m 0700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  install -m 0600 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  cat >"${ENV_FILE}" <<'EOF'
NODE_ENV=production
APP_VERSION=dev
PORT=3005

POSTGRES_DB=padelclaw
POSTGRES_USER=padelclaw
POSTGRES_PASSWORD=replace-me
DATABASE_URL=postgresql://padelclaw:replace-me@postgres:5432/padelclaw?schema=public

AGENT_MODEL=minimax-m2.7
OLLAMA_API_KEY=replace-me

META_ACCESS_TOKEN=replace-me
META_PHONE_NUMBER_ID=replace-me
META_VERIFY_TOKEN=replace-me
TRAINER_PHONE=491234567890

GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
GOOGLE_REFRESH_TOKEN=replace-me
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_TIMEZONE=Europe/Berlin

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=

DIALOG360_API_KEY=
DIALOG360_BASE_URL=https://waba-sandbox.360dialog.io
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${ENV_FILE}"
  chmod 0600 "${ENV_FILE}"
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 41641/udp
ufw allow in on tailscale0
ufw --force enable

cat <<EOF
Setup abgeschlossen.

Naechste Schritte:
1. sudo tailscale up --ssh
2. sudo -u ${DEPLOY_USER} -H bash -lc 'cd ${APP_ROOT} && git clone <repo-url> app'
3. Secrets in ${ENV_FILE} setzen
4. Im Repo: docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
EOF
