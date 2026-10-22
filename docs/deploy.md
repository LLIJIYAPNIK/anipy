# Деплой anipy.ru

Сайт живёт на сервере отдельным Docker-проектом, рядом с другими:

- [`Dockerfile`](../Dockerfile) собирает статику (`npm run sync && npm run build`) и кладёт её в `nginx:alpine` с конфигом [`deploy/nginx/site.conf`](../deploy/nginx/site.conf) — 404/500, `/` → `/ru/`, кэш `/_astro/`;
- GitHub Action [`deploy.yml`](../.github/workflows/deploy.yml) публикует образ в `ghcr.io/llijiyapnik/anipy`, копирует [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) в папку проекта на сервере и делает `docker compose pull && docker compose up -d`;
- контейнер слушает только `127.0.0.1:8081`, наружу его отдаёт nginx на хосте с конфигом [`deploy/nginx/anipy.ru.conf`](../deploy/nginx/anipy.ru.conf) — TLS и `proxy_pass`, как у остальных проектов.

Выкладка запускается при push в `main` (то есть после merge PR), вручную (Actions → Deploy → Run workflow) и по релизу SDK (событие `repository_dispatch` с типом `sdk-release`, см. ниже).

Пока секреты не заданы, workflow собирает и публикует образ, а сервер не трогает — с пометкой в логе.

## 1. Сервер

Нужны Docker с плагином compose и nginx с certbot на хосте; домен `anipy.ru` (и `www`) с A/AAAA-записями на IP сервера.

```bash
# Пользователь только для выкладки, без sudo.
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
# Папка проекта — сюда workflow кладёт docker-compose.yml.
sudo mkdir -p /srv/anipy
sudo chown deploy:deploy /srv/anipy
```

Группа `docker` даёт пользователю права, равные root, — поэтому у него нет пароля и входа по паролю, только ключ из GitHub Actions.

Если порт `8081` занят другим проектом, задайте свой в `/srv/anipy/.env` — compose подхватит его сам — и поправьте `proxy_pass` в конфиге nginx:

```bash
echo "ANIPY_PORT=8082" | sudo -u deploy tee /srv/anipy/.env
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

## 3. Секреты репозитория

Из папки репозитория (или GitHub → Settings → Secrets and variables → Actions):

```bash
gh secret set DEPLOY_HOST --body "anipy.ru"
gh secret set DEPLOY_USER --body "deploy"
gh secret set DEPLOY_PATH --body "/srv/anipy"
gh secret set DEPLOY_SSH_KEY < anipy_deploy
ssh-keyscan -t ed25519 anipy.ru | gh secret set DEPLOY_KNOWN_HOSTS
```

Отпечаток из `ssh-keyscan` сверьте с тем, что показывает сам сервер (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`). После этого приватный ключ на своей машине можно удалить.

## 4. Доступ к образу

Первый запуск workflow создаст пакет `anipy` в GitHub Container Registry закрытым. Репозиторий публичный, поэтому проще открыть и образ: GitHub → профиль → Packages → anipy → Package settings → Change visibility → Public. Тогда серверу не нужен токен для `docker compose pull`.

## 5. nginx на хосте и HTTPS

Сертификат выпускается до подключения конфига — конфиг уже ссылается на него:

```bash
sudo certbot certonly --nginx -d anipy.ru -d www.anipy.ru
sudo cp deploy/nginx/anipy.ru.conf /etc/nginx/sites-available/anipy.ru
sudo ln -s /etc/nginx/sites-available/anipy.ru /etc/nginx/sites-enabled/anipy.ru
sudo nginx -t && sudo systemctl reload nginx
```

certbot продлевает сертификат сам.

## 6. Первая выкладка

Actions → Deploy → Run workflow. Затем проверить:

- <https://anipy.ru/ru/> открывается, `https://anipy.ru/` ведёт на `/ru/`, `https://www.anipy.ru` — на `https://anipy.ru`;
- несуществующий адрес отдаёт страницу 404;
- на сервере `docker compose -f /srv/anipy/docker-compose.yml ps` показывает контейнер `site` в состоянии `healthy`.

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
