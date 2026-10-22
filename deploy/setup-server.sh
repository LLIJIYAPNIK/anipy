#!/usr/bin/env bash
# Подготовка сервера к деплою anipy.ru и вывод секретов для GitHub Actions.
# Запускать на сервере: sudo bash setup-server.sh [домен] [папка проекта]
#
# Создаёт пользователя deploy (в группе docker, без пароля), папку проекта,
# новый SSH-ключ для GitHub Actions и печатает пять секретов DEPLOY_*.
# Повторный запуск безопасен: пользователь и папка не пересоздаются,
# добавляется новый ключ (старые остаются в authorized_keys — удалите их вручную).
set -euo pipefail

HOST="${1:-anipy.ru}"
DEPLOY_PATH="${2:-/srv/anipy}"
DEPLOY_USER="deploy"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите через sudo: sudo bash $0 $*" >&2
  exit 1
fi
for cmd in docker ssh-keygen; do
  command -v "$cmd" >/dev/null || { echo "Не найден $cmd — сначала установите его." >&2; exit 1; }
done
docker compose version >/dev/null 2>&1 || { echo "Нужен плагин docker compose." >&2; exit 1; }

HOST_KEY=/etc/ssh/ssh_host_ed25519_key.pub
[ -r "$HOST_KEY" ] || { echo "Не найден $HOST_KEY — у SSH-сервера нет ключа ed25519." >&2; exit 1; }

# Пользователь только для выкладки: без пароля, вход только по ключу.
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
fi
usermod -aG docker "$DEPLOY_USER"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_PATH"

# Ключ для GitHub Actions: приватная часть выводится один раз и удаляется с сервера.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ssh-keygen -q -t ed25519 -N "" -C "anipy deploy $(date +%F)" -f "$TMP/key"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
cat "$TMP/key.pub" >> "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"

# known_hosts — из ключа самого сервера, а не через сеть.
KNOWN_HOSTS="$HOST $(cut -d' ' -f1,2 "$HOST_KEY")"

section() {
  printf '\n===== %s =====\n%s\n' "$1" "$2"
}

echo
echo "Сервер готов: пользователь $DEPLOY_USER, папка $DEPLOY_PATH."
echo "Добавьте секреты в GitHub → Settings → Secrets and variables → Actions:"
section DEPLOY_HOST "$HOST"
section DEPLOY_USER "$DEPLOY_USER"
section DEPLOY_PATH "$DEPLOY_PATH"
section DEPLOY_KNOWN_HOSTS "$KNOWN_HOSTS"
section DEPLOY_SSH_KEY "$(cat "$TMP/key")"
echo
echo "Приватный ключ больше нигде не хранится — сохраните его в секрет сейчас."
echo "Если на сервере SSH не на порту 22, напишите — workflow нужно будет поправить."
