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
- Ширина < 768px: аккордеон, кнопки с `aria-expanded`, зона нажатия не меньше 48px; 768–1100px — вводный блок над панелями.
- Раскрытая панель на главной забирает всё место, остальные сжимаются до колонки каны (`--panel-closed`).
- Фоновое видео панели — поле `video` в `sdks.ts`, файлы в `public/media/` готовит `scripts/prepare-video.mjs` (MP4 + WebM без звука, постер WebP). Видео грузится только при раскрытии панели, ч/б и приглушение — CSS-фильтром; при reduced motion и Save-Data — только постер.
- Стена обложек вместо видео — поле `covers` в `sdks.ts` (`components/CoverWall.astro`): колонки обложек бесконечно едут по вертикали, соседние — навстречу и со сдвигом. Обложки в `public/media/<имя>/` готовит `scripts/prepare-covers.py` через mangalib-python-sdk (популярная манга без 18+, WebP 240×336, `sources.json` — откуда каждая). Грузятся только при раскрытии, при Save-Data — нет; при reduced motion стоят на месте.
- Строка чтения вместо видео — поле `phrases` в `sdks.ts` (`components/ReadingLine.astro`): фразы из ранобэ едут вверх, неподвижная маска оставляет яркой полосу над описанием, к подробностям лента гаснет. Только CSS, только десктоп: в аккордеоне фразы шли бы под текстом. Фразы в `src/data/<имя>.json` готовит `scripts/prepare-phrases.py` через ranobelib-python-sdk — по списку «том, глава, абзац», дословно; отбор ручной (High School DxD — 16+).

## Масштаб и движение

- Размеры — в `rem` от макета на 1440px; корневой размер `clamp(16px, 100vw / 90, 28.44px)`: до 1440px 1rem = 16px, шире — всё растёт до 2560px. Новые размеры — тоже в `rem`, пиксели только для линий 1–2px и медиа-запросов.
- Страница в один экран (главная) — `<Base fit>`: шире 1100px масштаб по меньшему из ширины к 1440 и высоты к 900, раскладка сохраняет пропорции макета и не даёт прокрутки.
- Кнопка GitHub — только `components/GithubButton.astro`; своих вариантов не заводить.
- Цветов не добавляем: характер дают движение и плавность. Всё движение — в `styles/motion.css`, тайминги — токены в `tokens.css`, при `prefers-reduced-motion` они нулевые.
- Длительности в `transition` и `animation` — только через токены, никаких `400ms` в стилях компонентов: иначе reduced motion их не отключит. Новый тайминг — новый токен с нулём в блоке reduced motion.
- Атрибуты: `data-rise` (+ `--i`) — появление при загрузке по очереди; `data-reveal` — при прокрутке до блока (`scripts/motion.ts`); `data-draw` (+ `--d`) — кана «пишется» сверху вниз; `data-draw-circle` — энсо дорисовывается по кругу; `data-parallax` — вертикальная кана отстаёт от прокрутки.
- Скрытые до появления состояния — только под `html.js` (ставится в `<head>`): без JS всё видно.
- Переходы между страницами — View Transitions (`@view-transition`), логотип — `view-transition-name: site-logo`.
- Раскрытие по высоте — `grid-template-rows: 0fr ↔ 1fr` (аккордеон, строки покрытия); смена вкладок — `.tab-enter` (`playEnter` из `scripts/tabs.ts`).

## Стек

Astro, статическая сборка (`output: 'static'`), Node ≥ 22.18, npm. Python — только при сборке, для справочника API: `uv` (в CI — `astral-sh/setup-uv`, в Docker — бинарь из образа uv и системный python3). JS на клиенте только там, где без него нельзя: таблица покрытия API — единственный остров (Preact). Остальное — HTML и CSS.

## Структура

```
src/
  data/sdks.ts          # единый массив SDK; только стираемый TS — его импортирует sync
  i18n/en.ts, ru.ts     # строки интерфейса; ключи в обоих файлах совпадают
  content.config.ts     # коллекции из репозиториев SDK со схемами
  styles/tokens.css     # все цвета, шрифты, тайминги Spec V1 — только здесь
  lib/readme.ts         # достаёт из README SDK разделы Installation и Quickstart
  lib/mkdocs.ts         # nav из mkdocs.yml репозитория SDK → меню и страницы документации
  lib/markdown.ts       # markdown документации → HTML в стиле сайта (admonition, snippets, якоря как у mkdocs)
  lib/api-reference.ts  # справочник API: директивы `::: путь` → объекты из .sdk/api, ссылки autorefs и аннотаций
  lib/changelog.ts      # разбирает CHANGELOG.md (Keep a Changelog от git-cliff)
  lib/versions.ts       # последняя версия SDK: PyPI при сборке, без сети — CHANGELOG.md
  lib/coverage.ts       # покрытие API: endpoints.md + openapi.json (lib/openapi.ts) + методы SDK из данных griffe (lib/api-reference.ts)
  data/coverage-groups.ts # тег операции → группа таблицы покрытия, подписи групп из макета
  lib/examples.ts       # примеры из examples/ репозиториев SDK; пометка «аккаунт» — по чтению переменных окружения
  data/examples.ts      # названия примеров RU/EN и строка API из макета; без записи — из имени файла и README
  components/CoverageTable.tsx # единственный остров (Preact); подробности грузит из /data/coverage/<package>.json
  scripts/tabs.ts       # вкладки по SDK на Changelog и Coverage
  lib/grayscale-theme.ts# тема подсветки кода; дублирует цвета tokens.css (Shiki красит инлайном)
  layouts/Base.astro    # <head>, шрифты; шапки — в компонентах страниц
  components/DocsLayout.astro # каркас документации: шапка, меню страниц, «На этой странице»
  components/DocsSearch.astro # поиск по документации (Pagefind), Ctrl+K / ⌘K
  components/
  pages/[lang]/         # /en/…, /ru/…: главная, docs/<package>/ (обзор) и docs/<package|id общей документации>/<страница>/, examples/, changelog/, coverage/ (#<package> — вкладка), about/
  pages/data/coverage/  # статический JSON подробностей операций для таблицы покрытия
  pages/changelog.xml.ts # Atom-лента релизов всех SDK из CHANGELOG.md, одна на оба языка
  pages/404.astro, 500.astro # одна страница на весь сайт, оба языка (components/ErrorPage.astro); 500.html отдаёт сервер
public/logo.png         # знак ア в энсо из макета; на «О проекте» надпись под ним — текстом
scripts/sync-sdk.mjs    # клонирует репозитории из sdks.ts в .sdk/ и запускает api-reference.py
scripts/api-reference.py # griffe (через uv): директивы mkdocstrings из docs/ → .sdk/api/<репозиторий>.json
scripts/prepare-video.mjs # видео для панели: node scripts/prepare-video.mjs <исходник> <имя> [--poster <сек>]; ffmpeg из PATH или $FFMPEG
scripts/prepare-covers.py # обложки для стены: uv run scripts/prepare-covers.py [<имя>] [--count 50]
scripts/prepare-phrases.py # фразы для строки чтения: uv run scripts/prepare-phrases.py
public/media/           # видео, постеры и обложки панелей
scripts/prepare-og.mjs  # картинки превью ссылок: node scripts/prepare-og.mjs → public/og/<ключ>.png
public/og/              # превью ссылок 1200×630: anipy.png и по одной на SDK и общую документацию
public/robots.txt       # всё открыто, кроме /data/; ссылка на sitemap-index.xml
.sdk/                   # клоны репозиториев SDK для сборки, в git не попадает
```

- Страницы документации — ровно `nav` из `mkdocs.yml` репозитория SDK (`lib/mkdocs.ts`); `docsNav` в `sdks.ts` — какие разделы `nav` относятся к SDK, когда репозиторий документирует несколько пакетов. Документация, общая для нескольких SDK одного репозитория (ядро `libsocial-core`), — запись в `sharedDocs` (`sdks.ts`): свой адрес `/docs/<id>/…`, без знака SDK и вкладки; в меню SDK, чей `docsNav` называет её раздел, — ссылки на эти страницы, а не копии. `index.md`, `changelog.md`, `examples.md` заменяют свои страницы сайта (обзор, изменения, примеры). Текст не переводится и не правится — правки идут в репозиторий SDK; на русской версии над текстом — пометка об английском оригинале со ссылкой на исходный файл.
- Справочник API — директивы mkdocstrings из страниц SDK. Данные извлекает `scripts/api-reference.py` тем же griffe, что у mkdocstrings, с опциями из `mkdocs.yml` и самой директивы (`members`, `inherited_members`, `show_root_heading`, `show_bases`, `merge_init_into_class`, порядок членов); сайт только рисует. Объект, которого нет, роняет sync и сборку — как `mkdocs build --strict`. Версия griffe — в шапке скрипта, держать как у SDK.
- Версия SDK на панелях главной и в обзоре документации — `latestVersion()` (`lib/versions.ts`): PyPI при сборке, при недоступности — первая секция CHANGELOG.md с предупреждением в логе сборки. Сайт пересобирается по `sdk-release`, поэтому версия свежая без ручных правок.
- SEO (`layouts/Base.astro`): у каждой страницы `canonical`, пара `hreflang` ru/en с `x-default` на русскую, OG/Twitter-карточка; страницы ошибок — `noindex`. Карта сайта — `@astrojs/sitemap` (только `/ru/…` и `/en/…`). Картинка превью — `public/og/<ключ>.png` набора документации, иначе `anipy.png`; новый SDK — перезапустить `scripts/prepare-og.mjs` (без русского и английского текста — одна картинка на оба языка).
- Поиск — Pagefind: `npm run build` после `astro build` строит индекс в `dist/pagefind/` (свой на каждый язык). Индексируется только `<article data-pagefind-body>` страниц документации с фильтром `data-pagefind-filter="sdk:<ключ>"`; служебное внутри статьи (кнопки, «Назад/Далее», плашки API) — `data-pagefind-ignore`. В `npm run dev` индекса нет — поиск проверять через `npm run build` и `npm run preview`.
- Якорь объекта API — на его заголовке (Pagefind ссылается на разделы по заголовкам с id), у корня без заголовка — на `<section>`.
- Ссылки в документации: на другие `.md` — на страницы сайта, якоря — те же, что у mkdocs (`slugify` в `lib/markdown.ts`); на прочие файлы репозитория — на GitHub.
- Покрытие API есть у SDK с полем `coverage` в `sdks.ts`; у остальных вкладка показывает заглушку со ссылкой на `apiNotes`.
- Контент SDK читается только из `.sdk/`: README и CHANGELOG — через коллекции, страницы `docs/` — через `fs` в `lib/mkdocs.ts`, `openapi.json` и исходники Python — через `fs` в `lib/coverage.ts`. Схема коллекции падает, если в репозитории SDK пропало нужное поле: это правильно, обходить не надо.
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
npm run sync      # клонирует/обновляет репозитории SDK в .sdk/ и собирает справочник API (нужен uv)
npm run dev       # dev-сервер
npm run check     # astro check — типы и схемы контента
npm run build     # статическая сборка в dist/
```

Перед коммитом должны проходить `npm run check` и `npm run build`.
