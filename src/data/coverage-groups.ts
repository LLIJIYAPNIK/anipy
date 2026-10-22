// Группы таблицы покрытия AniLibria API: тег операции из спецификации → группа.
// Подписи групп — из макета. Сопоставление по самому длинному префиксу тега.

export type GroupKey =
  | 'app' | 'catalog' | 'franchises' | 'genres' | 'releases' | 'episodes' | 'ratings' | 'schedule'
  | 'torrents' | 'media' | 'teams' | 'auth' | 'collections' | 'favorites' | 'me' | 'ads';

export const groupLabels: Record<GroupKey, { ru: string; en: string }> = {
  app: { ru: 'Приложение', en: 'App' },
  catalog: { ru: 'Каталог', en: 'Catalog' },
  franchises: { ru: 'Франшизы', en: 'Franchises' },
  genres: { ru: 'Жанры', en: 'Genres' },
  releases: { ru: 'Релизы', en: 'Releases' },
  episodes: { ru: 'Эпизоды', en: 'Episodes' },
  ratings: { ru: 'Оценки', en: 'Ratings' },
  schedule: { ru: 'Расписание', en: 'Schedule' },
  torrents: { ru: 'Торренты', en: 'Torrents' },
  media: { ru: 'Медиа', en: 'Media' },
  teams: { ru: 'Команды', en: 'Teams' },
  auth: { ru: 'Авторизация', en: 'Authentication' },
  collections: { ru: 'Коллекции', en: 'Collections' },
  favorites: { ru: 'Избранное', en: 'Favorites' },
  me: { ru: 'Профиль и просмотры', en: 'Profile & watch progress' },
  ads: { ru: 'Реклама', en: 'Ads' },
};

const byTagPrefix: [string, GroupKey][] = [
  ['Приложение', 'app'],
  ['Аниме.Каталог', 'catalog'],
  ['Аниме.Франшизы', 'franchises'],
  ['Аниме.Жанры', 'genres'],
  ['Аниме.Релизы.Эпизоды', 'episodes'],
  ['Аниме.Релизы.Оценки', 'ratings'],
  ['Аниме.Релизы.РасписаниеРелизов', 'schedule'],
  ['Аниме.Релизы', 'releases'],
  ['Аниме.Торренты', 'torrents'],
  ['Медиа', 'media'],
  ['Команды', 'teams'],
  ['Аккаунты.ОдноразовыеПароли', 'auth'],
  ['Аккаунты.Пользователи.Авторизация', 'auth'],
  ['Аккаунты.Пользователи.Мое.Коллекции', 'collections'],
  ['Аккаунты.Пользователи.Мое.Избранное', 'favorites'],
  ['Аккаунты.Пользователи.Мое', 'me'],
  ['Реклама', 'ads'],
];

export const groupForTag = (tag: string): GroupKey | undefined =>
  byTagPrefix
    .filter(([prefix]) => tag === prefix || tag.startsWith(prefix + '.'))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
