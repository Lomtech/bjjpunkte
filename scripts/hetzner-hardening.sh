#!/usr/bin/env bash
# Hetzner-Server-Hardening fuer osss.pro Production.
#
# Auf einem frischen Ubuntu 24.04 LTS als root ausfuehren:
#   ssh root@<server-ip>
#   curl -fsSL https://raw.githubusercontent.com/Lomtech/bjjpunkte/main/scripts/hetzner-hardening.sh | bash
#
# Macht:
#   - System-Updates + unattended-upgrades fuer Security-Patches
#   - UFW-Firewall (deny default, allow SSH/HTTP/HTTPS)
#   - fail2ban gegen SSH-Brute-Force
#   - swapfile (4GB) — wichtig fuer 8GB-Server bei Spikes
#   - sysctl-tuning fuer Production-Web (somaxconn etc.)
#   - Coolify-Installation (Docker + Web-UI)
#   - Tailscale-Install (NICHT auto-up — Lom muss `tailscale up` selbst rufen)
#
# Zeit: ~10 Min total.

set -euo pipefail

log() { echo -e "\n\033[1;36m[$(date +%H:%M:%S)] $*\033[0m"; }
die() { echo -e "\n\033[1;31mFEHLER: $*\033[0m" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Muss als root laufen — sudo -i ODER ssh root@..."
[[ -f /etc/os-release ]] && grep -q "Ubuntu" /etc/os-release || die "Nur Ubuntu 24.04 LTS getestet."

log "== System-Update =="
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

log "== Basis-Packages =="
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl wget git htop ufw fail2ban unattended-upgrades apt-listchanges \
  ca-certificates gnupg lsb-release software-properties-common \
  net-tools dnsutils jq

log "== Unattended Security-Updates aktivieren =="
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF

log "== UFW-Firewall =="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp comment "HTTP — Traefik/Coolify"
ufw allow 443/tcp comment "HTTPS — Traefik/Coolify"
# Coolify-UI auf 8000 wird spaeter via Tailscale isoliert — vorerst public
# damit Lom sich initial einloggen kann. Hardening-Schritt B (nach Coolify-
# Setup): `ufw delete allow 8000` + Tailscale-Routing.
ufw allow 8000/tcp comment "Coolify-UI — TODO: hinter Tailscale verstecken"
ufw --force enable

log "== fail2ban gegen SSH-Brute-Force =="
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

log "== Swapfile (4GB) — Buffer bei Memory-Spikes =="
if ! swapon --show | grep -q swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
fi

log "== sysctl Production-Tuning =="
cat > /etc/sysctl.d/99-production.conf <<'EOF'
# Mehr backlog fuer Connection-Bursts (Coolify Traefik + Next.js)
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 4096
net.core.netdev_max_backlog = 5000

# Faster TIME_WAIT-Cleanup
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_tw_reuse = 1

# Limits fuer file-descriptors (Node.js hat viele offene Verbindungen)
fs.file-max = 2097152

# Security
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
kernel.randomize_va_space = 2
EOF
sysctl -p /etc/sysctl.d/99-production.conf >/dev/null

log "== Tailscale installieren (nicht auto-up) =="
curl -fsSL https://tailscale.com/install.sh | sh
# Lom muss manuell `tailscale up` rufen und im Browser auth durchklicken.
# Danach: `ufw delete allow 8000` + Coolify-UI nur ueber Tailscale-IP.

log "== Coolify installieren =="
if [[ ! -d /data/coolify ]]; then
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  log "Coolify-UI: http://$(curl -s ifconfig.me):8000"
  log "Initial-Login-Credentials: /data/coolify/source/.env (root@user/password)"
else
  log "Coolify schon installiert — uebersprungen"
fi

log "== Reboot? =="
if [[ -f /var/run/reboot-required ]]; then
  log "Reboot empfohlen (Kernel-Update). In 60s: 'shutdown -r +1'"
  shutdown -r +1
else
  log "Kein Reboot noetig"
fi

cat <<'DONE'

╔════════════════════════════════════════════════════════════════════╗
║  ✓ Hetzner-Server gehaertet + Coolify installiert                  ║
╠════════════════════════════════════════════════════════════════════╣
║  Naechste Schritte:                                                ║
║                                                                    ║
║  1. Coolify-UI oeffnen: http://<server-ip>:8000                    ║
║     → Account anlegen, 2FA aktivieren                              ║
║                                                                    ║
║  2. Tailscale aktivieren (UI-Schutz):                              ║
║     tailscale up                                                   ║
║     # Im Browser den Auth-Link oeffnen, dann:                      ║
║     ufw delete allow 8000                                          ║
║     # Coolify-UI nur noch via Tailscale-IP erreichbar              ║
║                                                                    ║
║  3. GitHub-Source in Coolify hinzufuegen (Sources → GitHub App)   ║
║     → bjjpunkte-Repo verlinken                                     ║
║                                                                    ║
║  4. Application anlegen:                                           ║
║     → Repository: Lomtech/bjjpunkte, Branch: main                  ║
║     → Build: Dockerfile (auto-erkannt)                             ║
║     → Domain: staging.osss.pro (erst staging!)                     ║
║     → Health Check: /api/health                                    ║
║                                                                    ║
║  5. Env-Vars importieren (scripts/migrate-env-from-vercel.sh)      ║
║                                                                    ║
║  Komplettes Playbook: docs/HETZNER_CUTOVER.md                      ║
╚════════════════════════════════════════════════════════════════════╝
DONE
