// Документация SDK из репозиториев: `nav` из mkdocs.yml → страницы сайта /<lang>/docs/<ключ>/<slug>/.
// Порядок, названия и состав страниц — ровно как в mkdocs.yml; сайт ничего не добавляет.
// Набор страниц — SDK коллекции или общая документация нескольких SDK (ядро, data/sdks.ts).
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { docSetKey, isSdk, sdks, sharedDocs, type DocSet, type SharedDocs } from '../data/sdks';

export type DocPage = {
  /** Путь под /docs/<ключ>/ без слэшей по краям: `guides/pagination`. */
  slug: string;
  /** Файл от каталога docs/ репозитория: `guides/pagination.md`. */
  file: string;
  /** Название из nav. */
  title: string;
};

/** Пункт меню: своя страница, страница общей документации (`set`) или раздел сайта вместо страницы. */
export type DocNavItem = { page: DocPage; set?: SharedDocs } | { title: string; site: 'changelog' | 'examples' };
export type DocNavGroup = { title?: string; items: DocNavItem[] };

type Nav = (string | Record<string, string | Nav>)[];

// Страницы, для которых у сайта есть свои: главная документации — обзор SDK,
// примеры и изменения — разделы сайта.
const sitePages: Record<string, 'overview' | 'changelog' | 'examples'> = {
  'index.md': 'overview',
  'changelog.md': 'changelog',
  'examples.md': 'examples',
};

/** Все наборы страниц: SDK коллекции и общая документация. */
export const docSets: readonly DocSet[] = [...sdks, ...sharedDocs];

/** Корень клона репозитория SDK в .sdk/. */
export const repoRoot = (set: DocSet) => `.sdk/${set.repo.dir}`;
/** Каталог docs/ репозитория (docs_dir mkdocs по умолчанию). */
export const docsRoot = (set: DocSet) => `${repoRoot(set)}/docs`;

const readNav = (set: DocSet): Nav => {
  const path = `${repoRoot(set)}/mkdocs.yml`;
  if (!existsSync(path)) return [];
  // В mkdocs.yml бывают python-теги (!!python/name:...) — их значения сайту не нужны.
  const config = parse(readFileSync(path, 'utf8'), { logLevel: 'silent' }) as { nav?: Nav } | null;
  return config?.nav ?? [];
};

const entry = (item: Nav[number]): [string | undefined, string | Nav] =>
  typeof item === 'string' ? [undefined, item] : (Object.entries(item)[0] as [string, string | Nav]);

const navItem = (set: DocSet, title: string | undefined, file: string): DocNavItem | undefined => {
  const site = isSdk(set) ? sitePages[file] : undefined;
  if (site === 'overview') return undefined;
  if (site === 'examples' && isSdk(set) && !set.examples) return undefined;
  if (site) return { title: title ?? file, site };
  const path = `${docsRoot(set)}/${file}`;
  if (!existsSync(path)) return undefined;
  const slug = file.replace(/\.md$/, '').replace(/(^|\/)index$/, '');
  return { page: { slug, file, title: title ?? slug } };
};

/** Вложенные уровни nav — плоским списком: на сайте глубина меню — одна группа. */
const flatten = (set: DocSet, nav: Nav): DocNavItem[] =>
  nav.flatMap((item) => {
    const [title, value] = entry(item);
    if (typeof value !== 'string') return flatten(set, value);
    const it = navItem(set, title, value);
    return it ? [it] : [];
  });

/** Общая документация того же репозитория, если раздел nav — её. */
const sharedSection = (set: DocSet, title: string | undefined) =>
  isSdk(set) ? sharedDocs.find((s) => s.section === title && s.repo.dir === set.repo.dir) : undefined;

const cache = new Map<DocSet, DocNavGroup[]>();

/** Меню набора: группы в порядке nav, страницы верхнего уровня подряд — в группе без названия.
 *  Раздел общей документации в меню SDK — ссылки на её страницы, а не свои копии. */
export const docsNav = (set: DocSet): DocNavGroup[] => {
  const cached = cache.get(set);
  if (cached) return cached;
  const sections = isSdk(set) ? set.docsNav : [set.section];
  const groups: DocNavGroup[] = [];
  for (const item of readNav(set)) {
    const [title, value] = entry(item);
    if (sections && !(title && sections.includes(title))) continue;
    const shared = sharedSection(set, title);
    if (shared) {
      const items = docsPages(shared).map((page) => ({ page, set: shared }));
      if (items.length) groups.push({ title, items });
    } else if (typeof value === 'string') {
      const it = navItem(set, title, value);
      if (!it) continue;
      const last = groups.at(-1);
      if (last && !last.title) last.items.push(it);
      else groups.push({ items: [it] });
    } else {
      const items = flatten(set, value);
      if (items.length) groups.push({ title, items });
    }
  }
  cache.set(set, groups);
  return groups;
};

/** Собственные страницы набора в порядке меню (без ссылок на общую документацию). */
export const docsPages = (set: DocSet): DocPage[] =>
  docsNav(set).flatMap((g) => g.items.flatMap((it) => ('page' in it && !it.set ? [it.page] : [])));

/** Адрес страницы документации на сайте; без страницы — обзор SDK. */
export const docUrl = (lang: string, set: DocSet, page?: DocPage) => `/${lang}/docs/${docSetKey(set)}/${page?.slug ? page.slug + '/' : ''}`;

/** Раздел сайта, заменяющий страницу документации, — с вкладкой этого SDK. */
export const siteUrl = (lang: string, set: DocSet, site: 'changelog' | 'examples') => `/${lang}/${site}/${isSdk(set) ? `#${set.package}` : ''}`;

/** Страница сайта для файла docs/ репозитория: сначала у того же набора, потом у соседей по репозиторию. */
export const findDoc = (lang: string, from: DocSet, file: string) => {
  const candidates = [from, ...docSets.filter((s) => s !== from && s.repo.dir === from.repo.dir)];
  for (const set of candidates) {
    const page = docsPages(set).find((p) => p.file === file);
    if (page) return docUrl(lang, set, page);
  }
  const site = sitePages[file];
  if (site === 'overview' && isSdk(from)) return docUrl(lang, from);
  if (site && site !== 'overview') return siteUrl(lang, from, site);
  return undefined;
};
