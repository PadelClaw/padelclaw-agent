# Hetzner VPS Setup for PadelClaw

Diese Anleitung richtet einen Hetzner Cloud VPS fuer `padelclaw.ai` mit Docker Compose, Caddy, Postgres, Tailscale und GitHub Actions Deploys ein.

Referenz: https://docs.hetzner.com/cloud/

## Ziel-Setup

- Server: Hetzner Cloud `CX32`
- Region: `fsn1` / Frankfurt
- OS: Ubuntu `22.04 LTS`
- Reverse Proxy + TLS: Caddy
- App: Next.js `padelclaw-agent` auf internem Port `3005`
- Datenbank: Postgres 16
- Admin-Zugang: Tailscale
- Deploy: GitHub Actions via SSH

## 1. Server in Hetzner anlegen

1. In Hetzner Cloud einloggen und `Add Server` waehlen.
2. Als Image `Ubuntu 22.04 LTS` waehlen.
3. Als Type `CX32` waehlen.
4. Als Location `Frankfurt (fsn1)` waehlen.
5. Einen Namen wie `padelclaw-prod-01` setzen.
6. Unter `SSH keys` den lokalen Public Key hinterlegen.
7. Server erstellen und die IPv4 notieren.

## 2. DNS vorbereiten

Bei Porkbun oder dem genutzten DNS-Provider:

- `A` Record fuer `padelclaw.ai` -> VPS IPv4
- Optional `A` Record fuer `www.padelclaw.ai` -> VPS IPv4

Warte, bis `dig padelclaw.ai` auf die Server-IP zeigt.

## 3. Erster SSH-Login

Vom lokalen Rechner:

```bash
ssh root@<VPS_IP>
```

Wenn der Key korrekt hinterlegt ist, gibt es kein Passwort-Prompt.

## 4. Initiales VPS-Setup ausfuehren

Im Repo liegt das Script [`scripts/setup-vps.sh`](/Users/svc-agent/Projects/dev/padelclaw-agent/scripts/setup-vps.sh). Auf dem Server:

```bash
curl -fsSL https://raw.githubusercontent.com/0xpatswien/padelclaw-agent/main/scripts/setup-vps.sh -o /tmp/setup-vps.sh
chmod +x /tmp/setup-vps.sh
sudo /tmp/setup-vps.sh
```

Was das Script erledigt:

- Systemupdate + Basis-Pakete
- Docker Engine + Compose Plugin
- Tailscale Installation
- UFW Grundregelwerk
- User `padelclaw` anlegen
- Verzeichnisse `/opt/padelclaw` und `/opt/padelclaw/backups`
- `.env.prod` Template erzeugen

## 5. Tailscale fuer Admin-Zugang aktivieren

Auf dem VPS:

```bash
sudo tailscale up --ssh
tailscale ip -4
```

Danach:

- VPS in der Tailscale Admin Console pruefen
- SSH kuenftig bevorzugt ueber die Tailscale-IP oder den MagicDNS-Namen nutzen
- Optional public SSH spaeter schliessen, falls CI/CD ueber Self-Hosted Runner oder Tailscale erfolgt

## 6. Firewall mit UFW setzen

Das Setup-Script aktiviert:

- `80/tcp` fuer HTTP
- `443/tcp` fuer HTTPS
- `41641/udp` fuer Tailscale
- eingehend sonst `deny`

Pruefen mit:

```bash
sudo ufw status verbose
```

Wichtig:

- Fuer reinen Admin-Zugang ist SSH ueber Tailscale vorgesehen.
- Die bereitgestellte GitHub Action deployed per SSH. Dafuer muss `VPS_HOST` aus GitHub erreichbar sein. Praktisch gibt es dafuer drei Wege:
  1. Port `22/tcp` temporaer oder per IP-Allowlist oeffnen
  2. Self-Hosted Runner direkt auf dem VPS nutzen
  3. GitHub Actions zusaetzlich an Tailscale anbinden

## 7. Repo auf den Server legen

Als `padelclaw` User:

```bash
sudo su - padelclaw
cd /opt/padelclaw
git clone git@github.com:0xpatswien/padelclaw-agent.git app
cd app
git checkout main
```

Falls Deploys via HTTPS statt SSH-Repo-URL laufen sollen, die Remote-URL entsprechend anpassen.

## 8. Produktions-Umgebungsvariablen setzen

Template liegt nach dem Setup unter `/opt/padelclaw/.env.prod`.

Beispiel:

```dotenv
NODE_ENV=production
APP_VERSION=main
PORT=3005

POSTGRES_DB=padelclaw
POSTGRES_USER=padelclaw
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://padelclaw:change-me@postgres:5432/padelclaw?schema=public

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
```

Hinweise:

- `DATABASE_URL` muss auf den Compose-Service `postgres` zeigen.
- `POSTGRES_PASSWORD`, `META_ACCESS_TOKEN`, `OLLAMA_API_KEY`, `GOOGLE_*` sind Pflicht fuer echten Betrieb.
- `APP_VERSION` kann im Deploy-Skript auf Commit SHA gesetzt werden.

## 9. Erster Deploy

Auf dem VPS im Repo:

```bash
cd /opt/padelclaw/app
cp /opt/padelclaw/.env.prod .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Dann pruefen:

```bash
docker compose -f docker-compose.prod.yml ps
curl -I http://localhost/healthz
curl https://padelclaw.ai/api/health
```

Erwartung:

- `postgres`, `padelclaw`, `caddy`, `backup` laufen
- `https://padelclaw.ai` hat ein gueltiges Let's Encrypt Zertifikat
- `/api/health` liefert JSON mit Status, Timestamp und Version

## 10. GitHub Actions Deploy einrichten

In GitHub Repo Settings -> Secrets and variables -> Actions folgende Secrets setzen:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

Empfehlung:

- `VPS_USER=padelclaw`
- `VPS_HOST` = oeffentliche IP oder DNS-Name des Servers
- Private Deploy-Key nur fuer diesen Server verwenden

Die Pipeline in [`.github/workflows/deploy.yml`](/Users/svc-agent/Projects/dev/padelclaw-agent/.github/workflows/deploy.yml) macht:

- `npm ci`
- `npm run build`
- SSH auf den VPS
- `git pull`
- `docker compose up -d --build`
- Health-Check gegen `/api/health`

## 11. Betrieb und Wartung

Hilfreiche Commands:

```bash
cd /opt/padelclaw/app
docker compose -f docker-compose.prod.yml logs -f padelclaw
docker compose -f docker-compose.prod.yml logs -f caddy
docker compose -f docker-compose.prod.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
ls -lh /opt/padelclaw/backups
```

## 12. Backup-Strategie

Der Service `backup` erstellt taeglich ein `pg_dump` nach `/backups`.

Host-Pfad:

- `/opt/padelclaw/backups`

Empfohlen zusaetzlich:

- Hetzner Backups fuer den Server aktivieren
- Dumps regelmaessig off-server kopieren, z. B. via Restic oder rclone

## 13. Troubleshooting

Wenn Caddy kein Zertifikat bekommt:

- DNS zeigt noch nicht auf den VPS
- Port `80` oder `443` ist blockiert
- Eine andere Software bindet bereits an `80/443`

Wenn `padelclaw` nicht startet:

- `.env.prod` auf fehlende Secrets pruefen
- `docker compose logs padelclaw` lesen
- DB-Verbindung in `DATABASE_URL` gegen `postgres:5432` pruefen

Wenn GitHub Deploy nicht verbindet:

- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` pruefen
- Erreichbarkeit von SSH aus GitHub sicherstellen
- Falls SSH nur ueber Tailscale offen ist: CI-Strategie anpassen
