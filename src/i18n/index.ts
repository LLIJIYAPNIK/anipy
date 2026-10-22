import { ru } from './ru';
import { en } from './en';

export const langs = ['ru', 'en'] as const;
export type Lang = (typeof langs)[number];
export type Key = keyof typeof ru;

const dict: Record<Lang, Record<Key, string>> = { ru, en };

export const t = (lang: Lang, key: Key) => dict[lang][key];

/** Тот же путь на другом языке: /ru/docs/x/ → /en/docs/x/. */
export const switchLang = (path: string, to: Lang) => path.replace(/^\/(ru|en)(?=\/|$)/, `/${to}`);
