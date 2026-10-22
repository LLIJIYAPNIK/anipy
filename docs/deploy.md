# Деплой anipy.ru

Сайт статический: `npm run build` собирает `dist/`, GitHub Action [`deploy.yml`](../.github/workflows/deploy.yml) выкладывает его на VPS через rsync по SSH, nginx отдаёт файлы.

Выкладка запускается:

- при push в `main` (то есть после merge PR);
- вручную — Actions → Deploy → Run workflow;
- по релизу SDK — событием `repository_dispatch` с типом `sdk-release` (см. ниже).

Пока секреты не заданы, workflow собирает и проверяет сайт, а выкладку пропускает с пометкой в логе.

## 1. Сервер

Нужны Linux с nginx и rsync, домен `anipy.ru` (и `www`) с A/AAAA-записями на IP сервера.

```bash
# Пользователь только для выкладки, без sudo.
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/anipy.ru
sudo chown deploy:deploy /var/www/anipy.ru
sudo apt install nginx rsync certbot python3-certbot-nginx
```

## 2. SSH-ключ для GitHub Actions

На своей машине, отдельный ключ без пароля:

```bash
ssh-keygen -t ed25519 -N "" -C "anipy deploy" -f anipy_deploy
```

Публичную часть — на сервер:

```bash
sudo -u deploy mkdir -p ~deploy/.ssh
sudo -u deploy tee -a ~deploy/.ssh/authorized_keys < anipy_deploy.pub
sudo chmod 700 ~deploy/.ssh && sudo chmod 600 ~deploy/.ssh/authorized_keys
```

Отпечаток сервера для `known_hosts` (проверьте, что он совпадает с тем, что показывает сам сервер):

```bash
ssh-keyscan -t ed25519 anipy.ru
```

## 3. Секреты репозитория

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Секрет | Значение |
|---|---|
| `DEPLOY_HOST` | `anipy.ru` или IP сервера |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/var/www/anipy.ru` |
| `DEPLOY_SSH_KEY` | содержимое приватного ключа `anipy_deploy` целиком |
| `DEPLOY_KNOWN_HOSTS` | строка из `ssh-keyscan` |

После этого приватный ключ на своей машине можно удалить.

## 4. nginx и HTTPS

Сертификат выпускается до подключения конфига — конфиг уже ссылается на него:

```bash
sudo certbot certonly --nginx -d anipy.ru -d www.anipy.ru
```

Конфиг из [`deploy/nginx/anipy.ru.conf`](../deploy/nginx/anipy.ru.conf):

```bash
sudo cp deploy/nginx/anipy.ru.conf /etc/nginx/sites-available/anipy.ru
sudo ln -s /etc/nginx/sites-available/anipy.ru /etc/nginx/sites-enabled/anipy.ru
sudo nginx -t && sudo systemctl reload nginx
```

Конфиг: редирект на HTTPS и с `www`, `/` → `/ru/`, долгий кэш для `/_astro/`, страницы `404.html` и `500.html`. certbot продлевает сертификат сам.

## 5. Первая выкладка

Actions → Deploy → Run workflow. Затем проверить <https://anipy.ru/ru/>, несуществующий адрес (должна открыться 404) и что `https://www.anipy.ru` ведёт на `https://anipy.ru`.

## Пересборка по релизу SDK

Чтобы сайт обновлялся после релиза SDK, в репозиторий SDK (py-aniliberty, libsocial-sdk) нужен fine-grained токен с доступом только к `LLIJIYAPNIK/anipy` и правом **Contents: Read and write** — секрет `ANIPY_DISPATCH_TOKEN`. В конец его release-workflow:

```yaml
      - name: Rebuild anipy.ru
        env:
          GH_TOKEN: ${{ secrets.ANIPY_DISPATCH_TOKEN }}
        run: >
          gh api repos/LLIJIYAPNIK/anipy/dispatches
          -f event_type=sdk-release
          -f "client_payload[repository]=${{ github.repository }}"
```
