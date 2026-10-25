# Образ anipy.ru: сборка статики и раздача её nginx. HTTPS — у nginx на хосте.

FROM node:22.22-alpine AS build
# git нужен npm run sync: он клонирует репозитории SDK в .sdk/; python3 и uv — для
# справочника API (scripts/api-reference.py запускает griffe).
RUN apk add --no-cache git python3
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /usr/local/bin/uv
# Python — системный из apk: uv не скачивает свой.
ENV UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run sync && npm run build

FROM nginx:1.30-alpine
COPY deploy/nginx/site.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ru/ || exit 1
