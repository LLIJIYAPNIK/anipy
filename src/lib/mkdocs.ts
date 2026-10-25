// Документация SDK из репозиториев: `nav` из mkdocs.yml → страницы сайта /<lang>/docs/<package>/<slug>/.
// Порядок, названия и состав страниц — ровно как в mkdocs.yml; сайт ничего не добавляет.
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { sdks, type Sdk } from '../data/sdks';

export type DocPage = {
  /** Путь под /docs/<package>/ без слэшей по краям: `guides/pagination`. */
  slug: string;
  /** Файл от каталога docs/ репозитория: `guides/pagination.md`. */
  file: string;
  /** Название из nav. */
  title: string;
};

/** Пункт меню: страница документации или свой раздел сайта вместо неё. */
export type DocNavItem = { page: DocPage } | { title: string; site: 'changelog' | 'examples' };
export type DocNavGroup = { title?: string; items: DocNavItem[] };

type Nav = (string | Record<string, string | Nav>)[];

// Страницы, для которых у сайта есть свои: главная документации — обзор SDK,
// примеры и изменения — разделы сайта.
const sitePages: Record<string, 'overview' | 'changelog' | 'examples'> = {
  'index.md': 'overview',
  'changelog.md': 'changelog',
  'examples.md': 'examples',
};

/** Корень клона репозитория SDK в .sdk/. */
export const repoRoot = (sdk: Sdk) => `.sdk/${sdk.repo.dir}`;
/** Каталог docs/ репозитория (docs_dir mkdocs по умолчанию). */
export const docsRoot = (sdk: Sdk) => `${repoRoot(sdk)}/docs`;

const readNav = (sdk: Sdk): Nav => {
  const path = `${repoRoot(sdk)}/mkdocs.yml`;
  if (!existsSync(path)) return [];
  // В mkdocs.yml бывают python-теги (!!python/name:...) — их значения сайту не нужны.
  const config = parse(readFileSync(path, 'utf8'), { logLevel: 'silent' }) as { nav?: Nav } | null;
  return config?.nav ?? [];
};

// Справочник API собирается директивами mkdocstrings (`::: aniliberty.X`); пока их нечем
// отрисовать (#64), такие страницы в меню не попадают.
const needsReference = (source: string) => /^:::\s/m.test(source);

const entry = (item: Nav[number]): [string | undefined, string | Nav] =>
  typeof item === 'string' ? [undefined, item] : (Object.entries(item)[0] as [string, string | Nav]);

const navItem = (sdk: Sdk, title: string | undefined, file: string): DocNavItem | undefined => {
  const site = sitePages[file];
  if (site === 'overview') return undefined;
  if (site === 'examples' && !sdk.examples) return undefined;
  if (site) return { title: title ?? file, site };
  const path = `${docsRoot(sdk)}/${file}`;
  if (!existsSync(path) || needsReference(readFileSync(path, 'utf8'))) return undefined;
  const slug = file.replace(/\.md$/, '').replace(/(^|\/)index$/, '');
  return { page: { slug, file, title: title ?? slug } };
};

/** Вложенные уровни nav — плоским списком: на сайте глубина меню — одна группа. */
const flatten = (sdk: Sdk, nav: Nav): DocNavItem[] =>
  nav.flatMap((item) => {
    const [title, value] = entry(item);
    if (typeof value !== 'string') return flatten(sdk, value);
    const it = navItem(sdk, title, value);
    return it ? [it] : [];
  });

const cache = new Map<Sdk, DocNavGroup[]>();

/** Меню документации SDK: группы в порядке nav, страницы верхнего уровня подряд — в группе без названия. */
export const docsNav = (sdk: Sdk): DocNavGroup[] => {
  const cached = cache.get(sdk);
  if (cached) return cached;
  const groups: DocNavGroup[] = [];
  for (const item of readNav(sdk)) {
    const [title, value] = entry(item);
    if (sdk.docsNav && !(title && sdk.docsNav.includes(title))) continue;
    if (typeof value === 'string') {
      const it = navItem(sdk, title, value);
      if (!it) continue;
      const last = groups.at(-1);
      if (last && !last.title) last.items.push(it);
      else groups.push({ items: [it] });
    } else {
      const items = flatten(sdk, value);
      if (items.length) groups.push({ title, items });
    }
  }
  cache.set(sdk, groups);
  return groups;
};

/** Страницы документации SDK в порядке меню. */
export const docsPages = (sdk: Sdk): DocPage[] =>
  docsNav(sdk).flatMap((g) => g.items.flatMap((it) => ('page' in it ? [it.page] : [])));

/** Адрес страницы документации на сайте. */
export const docUrl = (lang: string, sdk: Sdk, page?: DocPage) => `/${lang}/docs/${sdk.package}/${page?.slug ? page.slug + '/' : ''}`;

/** Раздел сайта, заменяющий страницу документации, — с вкладкой этого SDK. */
export const siteUrl = (lang: string, sdk: Sdk, site: 'changelog' | 'examples') => `/${lang}/${site}/#${sdk.package}`;

/** Страница сайта для файла docs/ репозитория: сначала у того же SDK, потом у соседей по репозиторию. */
export const findDoc = (lang: string, from: Sdk, file: string) => {
  const candidates = [from, ...sdks.filter((s) => s !== from && s.repo.dir === from.repo.dir)];
  for (const sdk of candidates) {
    const page = docsPages(sdk).find((p) => p.file === file);
    if (page) return docUrl(lang, sdk, page);
  }
  const site = sitePages[file];
  if (site === 'overview') return docUrl(lang, from);
  if (site) return siteUrl(lang, from, site);
  return undefined;
};
