# ANIPY

Сайт [anipy.ru](https://anipy.ru) — витрина коллекции Python SDK для аниме, манги и ранобэ. Сайт ничего не реализует сам: он показывает репозитории SDK в красивом виде.

Источники правды — репозитории SDK:
- `py-aniliberty` — https://github.com/LLIJIYAPNIK/py-aniliberty (AniLibria)
- `libsocial-sdk` — https://github.com/LLIJIYAPNIK/libsocial-sdk (MangaLib, RanobeLib в `packages/`)

## Правила

- **Контент не выдумывать.** Описания, сигнатуры методов, примеры, таблицы покрытия API и changelog берутся из репозитория SDK или из макета. Если ни там, ни там чего-то нет, на сайте этого тоже нет: раздел не выводится.
- **Макет — эталон вида.** `ANIPY Homepage.html` (артборды: главная, документация, About, Examples, Changelog, API coverage, 404, 500, мобильная). Размеры и отступы берутся из него, не на глаз.
- **Roadmap живёт в issues** этого репозитория (закреплённая issue #1, milestones). `ROADMAP.md` и списки планов в файлах не создавать.
- **SDK — один массив данных** (номер, кана/кандзи, название, пакет, платформа, маршрут). Новый SDK добавляется записью в массив, а не новой разметкой.
- **Два языка: EN и RU.** Любая новая строка интерфейса добавляется сразу на обоих. Японские заголовки не переводятся.
- **Визуальный язык фиксирован** (Spec V1, ниже). Новые цвета, шрифты и тайминги анимаций не добавлять без согласования.

## Визуальный язык (Spec V1)

- **Цвета:** фон `#000000`, раскрытая строка таблицы `#080808`, фон кода `#0A0A0A`, панель при наведении `#111111`, линии между пунктами списка `#1A1A1A`, разделители `#292929`, рамки кнопок `#3A3A3A`, приглушённый текст `#8C8C8C`, вторичный `#A6A6A6`, третичный `#B3B3B3`, мягкий основной `#D9D9D9`, основной `#F5F5F5`.
- **Шрифты:** Shippori Mincho 800 — японские заголовки (vertical-rl); Cormorant Garamond 300 — латиница и римские номера SDK (I–III); JetBrains Mono — метаданные (10–11px, +0.2em).
- **Анимация:** 560ms `cubic-bezier(.65,0,.35,1)`; появление 420ms, исчезание 160ms. При `prefers-reduced-motion` все переходы отключены.

## Поведение

- Вся панель SDK — одна ссылка на `/docs/<package>/`. Ссылка на GitHub стоит рядом, никогда не вложена в панель, открывается в новой вкладке.
- Фокус раскрывает панель так же, как наведение. Кольцо фокуса — 1px цвета текста, inset 10px.
- Ширина < 768px: аккордеон, кнопки с `aria-expanded`, зона нажатия не меньше 48px.

## Стек

Astro, статическая сборка (`output: 'static'`), Node ≥ 22.18, npm. JS на клиенте только там, где без него нельзя: таблица покрытия API — единственный остров (Preact). Остальное — HTML и CSS.

## Структура

```
src/
  data/sdks.ts          # единый массив SDK; только стираемый TS — его импортирует sync
  i18n/en.ts, ru.ts     # строки интерфейса; ключи в обоих файлах совпадают
  content.config.ts     # коллекции из репозиториев SDK со схемами
  styles/tokens.css     # все цвета, шрифты, тайминги Spec V1 — только здесь
  lib/readme.ts         # достаёт из README SDK разделы Installation и Quickstart
  lib/changelog.ts      # разбирает CHANGELOG.md (Keep a Changelog от git-cliff)
  lib/coverage.ts       # покрытие API: endpoints.md + openapi.json (lib/openapi.ts) + docstring-и (lib/pydoc.ts)
  data/coverage-groups.ts # тег операции → группа таблицы покрытия, подписи групп из макета
  lib/examples.ts       # примеры из examples/ репозиториев SDK; пометка «аккаунт» — по чтению переменных окружения
  data/examples.ts      # названия примеров RU/EN и строка API из макета; без записи — из имени файла и README
  components/CoverageTable.tsx # единственный остров (Preact); подробности грузит из /data/coverage/<package>.json
  scripts/tabs.ts       # вкладки по SDK на Changelog и Coverage
  lib/grayscale-theme.ts# тема подсветки кода; дублирует цвета tokens.css (Shiki красит инлайном)
  layouts/Base.astro    # <head>, шрифты; шапки — в компонентах страниц
  components/
  pages/[lang]/         # /en/…, /ru/…: главная, docs/<package>/, examples/, changelog/, coverage/ (#<package> — вкладка), about/
  pages/data/coverage/  # статический JSON подробностей операций для таблицы покрытия
  pages/404.astro, 500.astro # одна страница на весь сайт, оба языка (components/ErrorPage.astro); 500.html отдаёт сервер
public/logo.png         # знак ア в энсо из макета; logo-full.png — с надписью, для About
scripts/sync-sdk.mjs    # клонирует репозитории из sdks.ts в .sdk/
.sdk/                   # клоны репозиториев SDK для сборки, в git не попадает
```

- Покрытие API есть у SDK с полем `coverage` в `sdks.ts`; у остальных вкладка показывает заглушку со ссылкой на `apiNotes`.
- Контент SDK читается только из `.sdk/`: markdown — через коллекции, `openapi.json` и исходники Python — через `fs` в `lib/coverage.ts`. Схема коллекции падает, если в репозитории SDK пропало нужное поле: это правильно, обходить не надо.
- Цвета и размеры в компонентах — только через переменные из `tokens.css`, без литералов.
- Клоны в `.sdk/` на Windows приходят с CRLF: разбирая markdown, сначала нормализуй переводы строк.
- Стили, задевающие разметку дочернего компонента через `:has()`, пиши как `:global(...)` целиком: Astro не разворачивает `:global()` внутри `:has()`.

## CI и деплой

- `.github/workflows/ci.yml` — `sync`, `check`, `build` и сборка Docker-образа со smoke-тестом на каждый PR и push в `main`.
- `.github/workflows/deploy.yml` — образ в `ghcr.io/llijiyapnik/anipy`, затем `docker compose pull && up -d` на VPS; при push в `main`, вручную и по `repository_dispatch: sdk-release` из репозиториев SDK.
- `Dockerfile` — сборка статики + `nginx:alpine` с `deploy/nginx/site.conf` (404/500, редиректы, кэш). На сервере контейнер слушает `127.0.0.1:8081`, TLS — у nginx на хосте (`deploy/nginx/anipy.ru.conf`). Настройка сервера и секреты — `docs/deploy.md`.

## Команды

```bash
npm install
npm run sync      # клонирует/обновляет репозитории SDK в .sdk/
npm run dev       # dev-сервер
npm run check     # astro check — типы и схемы контента
npm run build     # статическая сборка в dist/
```

Перед коммитом должны проходить `npm run check` и `npm run build`.
