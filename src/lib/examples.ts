// Примеры SDK из папки examples/ клона в .sdk/: список файлов, пометка «аккаунт»
// и строка API из README примеров, если её нет в src/data/examples.ts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Sdk } from '../data/sdks';
import { exampleCopy } from '../data/examples';

export type Example = {
  sdk: Sdk;
  file: string;
  num: string;
  title: { ru: string; en: string };
  api: string;
  /** Скрипт берёт учётные данные из окружения. */
  account: boolean;
  href: string;
};

const read = (path: string) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

/** Колонка Feature таблицы README примеров: `file → описание без разметки`. */
const readmeFeatures = (md: string) =>
  Object.fromEntries(
    [...md.replace(/\r\n/g, '\n').matchAll(/^\| \[`([^`]+)`\]\([^)]*\) \| (.+) \|$/gm)].map((m) => [
      m[1],
      m[2].replace(/`/g, '').replace(/\s+—\s+.*$/, '').trim(),
    ]),
  );

/** `08_download_title.py` → `Download title`. */
const fromFileName = (file: string) => {
  const words = file.replace(/^\d+_/, '').replace(/\.py$/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const loadExamples = (sdk: Sdk): Example[] => {
  if (!sdk.examples) return [];
  const { dir, only, skip } = sdk.examples;
  const base = join('.sdk', sdk.repo.dir, dir);
  let files: string[];
  try {
    files = readdirSync(base).filter((f) => /^\d+_.+\.py$/.test(f));
  } catch {
    return [];
  }
  const features = readmeFeatures(read(join(base, 'README.md')));
  const web = sdk.repo.url.replace(/\.git$/, '');

  return files
    .filter((f) => (!only || f.includes(only)) && (!skip || !f.includes(skip)))
    .sort()
    .map((file) => {
      const copy = exampleCopy[`${sdk.repo.dir}/${file}`];
      const name = fromFileName(file);
      return {
        sdk,
        file,
        num: file.slice(0, 2),
        title: copy?.title ?? { ru: name, en: name },
        api: copy?.api ?? features[file] ?? '',
        account: /os\.environ|getenv\(/.test(read(join(base, file))),
        href: `${web}/blob/main/${dir}/${file}`,
      };
    });
};
