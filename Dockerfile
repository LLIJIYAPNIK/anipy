# Образ anipy.ru: сборка статики и раздача её nginx. HTTPS — у nginx на хосте.

FROM node:22.22-alpine AS build
# git нужен npm run sync: он клонирует репозитории SDK в .sdk/.
RUN apk add --no-cache git
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
