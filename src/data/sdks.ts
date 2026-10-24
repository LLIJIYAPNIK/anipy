// Единый массив SDK коллекции. Новый SDK — новая запись здесь.
// Файл импортирует и scripts/sync-sdk.mjs (Node с type stripping),
// поэтому только стираемый TypeScript: без enum, namespace и импортов.

type Text = { ru: string; en: string };

export type Sdk = {
  /** Римский номер. */
  number: 'I' | 'II' | 'III';
  /** Японский заголовок; не переводится. */
  kana: string;
  label: Text;
  description: Text;
  /** Имя пакета на PyPI; он же сегмент маршрута /docs/<package>/. */
  package: string;
  platform: string;
  python: string;
  license: string;
  github: string;
  /** Клон для `npm run sync`. Несколько SDK могут жить в одном репозитории. */
  repo: { url: string; dir: string; path: string };
  /** Текст макета перед кодом быстрого старта; без него абзаца нет. */
  quickstartIntro?: Text;
  /** Справочник API из макета; без него раздела нет. */
  api?: { name: string; description: Text }[];
  /** Пути внутри каталога SDK для страницы покрытия API; без них — заглушка. */
  coverage?: { api: string; endpoints: string; spec: string; source: string };
  /** Заметки об API, когда публичной спецификации нет. */
  apiNotes?: string;
  /** Папка примеров от корня репозитория; общую папку делят по подстроке в имени файла. */
  examples?: { dir: string; only?: string; skip?: string };
  /** Фоновое видео раскрытой панели на главной: имя файлов в public/media/
   *  (<name>.webm, <name>.mp4, <name>-poster.webp — scripts/prepare-video.mjs). */
  video?: string;
  /** Стена обложек вместо видео: папка в public/media/ (scripts/prepare-covers.py). */
  covers?: string;
};

export const sdks: readonly Sdk[] = [
  {
    number: 'I',
    kana: 'アニメ',
    label: { ru: 'Аниме', en: 'Anime' },
    description: {
      ru: 'Асинхронный Python SDK для API AniLibria: релизы, эпизоды с HLS-ссылками, каталог, расписание, торренты и функции аккаунта.',
      en: 'Async Python SDK for the AniLibria API: releases, episodes with HLS links, catalog, schedule, torrents and account features.',
    },
    package: 'py-aniliberty',
    platform: 'AniLiberty',
    python: '3.11+',
    license: 'MIT',
    github: 'https://github.com/LLIJIYAPNIK/py-aniliberty',
    repo: { url: 'https://github.com/LLIJIYAPNIK/py-aniliberty.git', dir: 'py-aniliberty', path: '' },
    quickstartIntro: {
      ru: 'Откройте клиент как асинхронный контекстный менеджер, получите последние релизы, затем загрузите один релиз и HLS-ссылку его первого эпизода.',
      en: 'Open a client as an async context manager, list the latest releases, then fetch one release and the HLS link of its first episode.',
    },
    api: [
      { name: 'AniLiberty()', description: { ru: 'Асинхронный клиент; используется через async with.', en: 'Async client; use it with async with.' } },
      { name: 'client.releases.latest(limit)', description: { ru: 'Последние релизы.', en: 'The latest releases.' } },
      { name: 'client.releases.get(alias)', description: { ru: 'Релиз по его алиасу.', en: 'A release by its alias.' } },
      { name: 'client.episodes.get(id)', description: { ru: 'Эпизод с HLS-ссылками (hls_1080, hls_720).', en: 'An episode with HLS links (hls_1080, hls_720).' } },
    ],
    coverage: { api: 'AniLibria API v1', endpoints: 'docs/endpoints.md', spec: 'spec/openapi.json', source: 'src/aniliberty' },
    examples: { dir: 'examples' },
    video: 'anime',
  },
  {
    number: 'II',
    kana: 'ラノベ',
    label: { ru: 'Ранобэ', en: 'Light novels' },
    description: {
      ru: 'Асинхронный Python SDK для ranobelib.me: метаданные тайтлов, загрузка глав и томов, экспорт в EPUB, FB2, TXT и PDF.',
      en: 'Async Python SDK for ranobelib.me: title metadata, chapter and volume downloads, export to EPUB, FB2, TXT and PDF.',
    },
    package: 'ranobelib-python-sdk',
    platform: 'RanobeLib',
    python: '3.11+',
    license: 'MIT',
    github: 'https://github.com/LLIJIYAPNIK/libsocial-sdk/tree/main/packages/ranobelib',
    repo: { url: 'https://github.com/LLIJIYAPNIK/libsocial-sdk.git', dir: 'libsocial-sdk', path: 'packages/ranobelib' },
    apiNotes: 'https://github.com/LLIJIYAPNIK/libsocial-sdk/blob/main/docs/api-notes.md',
    examples: { dir: 'examples', skip: 'mangalib' },
  },
  {
    number: 'III',
    kana: '漫画',
    label: { ru: 'Манга', en: 'Manga' },
    description: {
      ru: 'Асинхронный Python SDK для mangalib.me: метаданные тайтлов, главы, переводы, каталог и изображения страниц.',
      en: 'Async Python SDK for mangalib.me: title metadata, chapters, translations, catalog and page images.',
    },
    package: 'mangalib-python-sdk',
    platform: 'MangaLib',
    python: '3.11+',
    license: 'MIT',
    github: 'https://github.com/LLIJIYAPNIK/libsocial-sdk/tree/main/packages/mangalib',
    repo: { url: 'https://github.com/LLIJIYAPNIK/libsocial-sdk.git', dir: 'libsocial-sdk', path: 'packages/mangalib' },
    apiNotes: 'https://github.com/LLIJIYAPNIK/libsocial-sdk/blob/main/docs/api-notes.md',
    examples: { dir: 'examples', only: 'mangalib' },
    covers: 'manga',
  },
];

export const owner = 'https://github.com/LLIJIYAPNIK';

/** Каталог SDK внутри .sdk/ относительно корня проекта. */
export const sdkDir = (sdk: Sdk) => ['.sdk', sdk.repo.dir, sdk.repo.path].filter(Boolean).join('/');

/** Файл SDK на GitHub по пути внутри каталога пакета. */
export const repoFileUrl = (sdk: Sdk, file: string) =>
  `${sdk.repo.url.replace(/\.git$/, '')}/blob/main/${[sdk.repo.path, file].filter(Boolean).join('/')}`;

/** CHANGELOG.md SDK на GitHub. */
export const changelogUrl = (sdk: Sdk) => repoFileUrl(sdk, 'CHANGELOG.md');
