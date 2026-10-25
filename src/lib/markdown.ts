// Markdown документации SDK → HTML в стиле сайта, на этапе сборки.
// Повторяет то, что включено в mkdocs.yml репозиториев: GFM-таблицы, admonition (`!!! note "…"`),
// pymdownx.snippets (`--8<-- "файл"`), toc (якоря заголовков как у mkdocs — ссылки вида
// `api-notes.md#раздел` из документации продолжают работать), autorefs (`[текст][aniliberty.X]`)
// и директивы mkdocstrings (`::: aniliberty.X` — объект справочника API, lib/api-reference.ts).
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import type { Root as MdRoot, Paragraph, Code, RootContent, PhrasingContent } from 'mdast';
import type { Root as HRoot, Element, ElementContent } from 'hast';
import { highlight, langs, type Lang } from './highlight';

export type TocEntry = { depth: 2 | 3; id: string; text: string };

export type RenderOptions = {
  /** Корень репозитория SDK: от него читаются сниппеты. */
  repoRoot: string;
  /** Файл от каталога docs/: от него разрешаются относительные ссылки. */
  file: string;
  /** Страница сайта для файла docs/ (с якорем или без) — или undefined, если на сайте её нет. */
  resolveDoc: (file: string) => string | undefined;
  /** Файл репозитория на GitHub по пути от корня репозитория. */
  repoUrl: (path: string) => string;
  /** Подписи кнопки копирования кода. */
  labels: { copy: string; copied: string; copyCode: string };
  /** Адрес объекта API по его пути (autorefs) — или undefined, если на сайте его нет. */
  resolveRef?: (path: string) => string | undefined;
  /** Директива `::: путь`: HTML объекта и его пункт в «На этой странице». */
  renderDirective?: (ident: string) => { toc?: TocEntry; html: () => Promise<string> };
};

export type RenderedDoc = { title?: string; html: string; toc: TocEntry[] };

const markdown = () => unified().use(remarkParse).use(remarkGfm);

/** Лежит ли путь внутри каталога (сам каталог — тоже внутри). */
const isInside = (dir: string, path: string) => {
  const rel = relative(dir, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

/** pymdownx.snippets: строка `--8<-- "путь"` заменяется файлом от корня репозитория.
 *  Путь, выходящий за корень (`../`, абсолютный, симлинк наружу), роняет сборку: иначе markdown
 *  из репозитория SDK мог бы вставить в сайт любой файл с машины, где идёт сборка. */
const expandSnippets = (md: string, root: string) =>
  md.replace(/^--8<--\s+"([^"]+)"\s*$/gm, (line, path: string) => {
    const base = resolve(root);
    const file = resolve(base, path);
    const outside = () => new Error(`Snippet "${path}" is outside the SDK repository ${root}`);
    if (!isInside(base, file)) throw outside();
    if (!existsSync(file)) return line;
    if (!isInside(realpathSync(base), realpathSync(file))) throw outside();
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  });

// admonition: после строки `!!! тип "заголовок"` — пустая строка, чтобы тело с отступом в 4 пробела
// разобралось как отдельный блок кода, а не как продолжение абзаца; дальше remarkAdmonitions.
const separateAdmonitions = (md: string) => md.replace(/^(!!!\s+\w+.*)$/gm, '$1\n');

// Директива mkdocstrings с блоком `options:` под ней (отступ 4 пробела) → блок кода anipy-api
// с путём объекта: так она переживает разбор markdown и заменяется объектом при обходе.
const directiveBlocks = (md: string) => md.replace(/^:::[ \t]+(\S+)[ \t]*$(?:\n(?: {4}.*|[ \t]*)$)*/gm, '\n```anipy-api\n$1\n```\n');

// autorefs: ссылки на объекты API без определения ссылки в тексте. Как обычный markdown они
// разобрались бы буквальным текстом, поэтому заранее превращаются в ссылки со схемой anipy-ref:.
const autorefs = (md: string) =>
  md
    .replace(/\[((?:[^[\]\n]|\[[^\]\n]*\])+)\]\[([A-Za-z_]\w*(?:\.\w+)+)\]/g, '[$1](anipy-ref:$2)')
    .replace(/\[(`?)([A-Za-z_]\w*(?:\.\w+)+)\1\]\[\]/g, '[$1$2$1](anipy-ref:$2)');

const remarkAdmonitions = () => (tree: MdRoot) => {
  visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
    if (!parent || index === undefined) return;
    const head = toPlain(node).match(/^!!!\s+(\w+)(?:\s+"(.*)")?\s*$/);
    const body = parent.children[index + 1];
    if (!head || body?.type !== 'code' || (body as Code).lang) return;
    const [, kind, title] = head;
    const titleChildren = (markdown().parse(title ?? kind[0].toUpperCase() + kind.slice(1)).children[0] as Paragraph | undefined)?.children ?? [];
    const admonition = {
      type: 'admonition',
      data: { hName: 'aside', hProperties: { className: ['admonition', `admonition-${kind}`] } },
      children: [
        { type: 'paragraph', data: { hProperties: { className: ['admonition-title'] } }, children: titleChildren },
        ...markdown().parse((body as Code).value).children,
      ],
    } as unknown as RootContent;
    parent.children.splice(index, 2, admonition);
    return [SKIP, index + 1];
  });
};

const toPlain = (node: Paragraph) =>
  node.children.map((c: PhrasingContent) => ('value' in c ? (c.type === 'inlineCode' ? '`' + c.value + '`' : c.value) : '')).join('');

/** Якорь заголовка как у markdown.extensions.toc (mkdocs): ASCII, без пунктуации, через дефис. */
export const slugify = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');

/** Повтор якоря — с суффиксом `_1`, `_2`, как у toc. */
const unique = (id: string, seen: Set<string>) => {
  while (seen.has(id) || !id) {
    const m = id.match(/^(.*)_(\d+)$/);
    id = m ? `${m[1]}_${Number(m[2]) + 1}` : `${id}_1`;
  }
  seen.add(id);
  return id;
};

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const copyIcon =
  '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.1"></rect><path d="M11 5V2H2v9h3" fill="none" stroke="currentColor" stroke-width="1.1"></path></svg>';

/** Блок кода — та же разметка, что у components/CodeBlock.astro: подпись языка и копирование. */
const codeFigure = async (code: string, lang: string, labels: RenderOptions['labels']) => {
  const body = (langs as readonly string[]).includes(lang) ? await highlight(code, lang as Lang) : escapeText(code);
  return (
    '<figure class="code"><figcaption>' +
    `<span class="meta">${escapeText((lang || 'text').toUpperCase())}</span>` +
    `<button class="copy meta" type="button" data-pagefind-ignore aria-label="${escapeAttr(labels.copyCode)}" data-copy="${escapeAttr(code)}" data-done="${escapeAttr(labels.copied.toUpperCase())}">` +
    `${copyIcon}<span aria-live="polite">${escapeText(labels.copy.toUpperCase())}</span></button>` +
    `</figcaption><pre><code>${body}</code></pre></figure>`
  );
};

const isElement = (node: unknown, tag?: string): node is Element =>
  (node as Element)?.type === 'element' && (!tag || (node as Element).tagName === tag);

/** Ссылка из документа: на страницу сайта, на файл репозитория на GitHub или наружу. */
const rewriteHref = (href: string, opts: RenderOptions) => {
  if (href.startsWith('#') || /^[a-z][a-z+.-]*:/i.test(href)) return href;
  const [path, hash] = href.split('#');
  const file = posix.normalize(posix.join(posix.dirname(opts.file), path));
  const anchor = hash ? `#${hash}` : '';
  if (path.endsWith('.md')) {
    const page = opts.resolveDoc(file);
    if (page) return page.replace(/#.*$/, '') + (anchor || (page.includes('#') ? page.slice(page.indexOf('#')) : ''));
  }
  return opts.repoUrl(posix.normalize(posix.join('docs', file))) + anchor;
};

/** Markdown → HTML: страница (`page` — заголовок первого уровня уходит в title, h2/h3 — в оглавление)
 *  или фрагмент (docstring объекта API). */
const render = async (source: string, opts: RenderOptions, page: boolean): Promise<RenderedDoc> => {
  let md = source.replace(/\r\n/g, '\n');
  if (page) md = directiveBlocks(expandSnippets(md, opts.repoRoot));
  md = autorefs(separateAdmonitions(md));
  const processor = markdown().use(remarkAdmonitions).use(remarkRehype);
  const tree = (await processor.run(processor.parse(md))) as HRoot;

  const toc: TocEntry[] = [];
  const seen = new Set<string>();
  let title: string | undefined;
  // Асинхронные замены (подсветка кода, объекты API) — после обхода, в порядке документа.
  const later: { node: Element; parent: { children: ElementContent[] }; html: () => Promise<string> }[] = [];

  visit(tree, 'element', (node: Element, index, parent) => {
    if (!parent || index === undefined) return;
    const heading = node.tagName.match(/^h([1-6])$/);
    if (heading) {
      const text = toString(node).trim();
      // Заголовок первого уровня — название страницы, страница выводит его сама.
      if (page && heading[1] === '1' && title === undefined) {
        title = text;
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
      const id = unique(slugify(text), seen);
      node.properties = { ...node.properties, id };
      if (page && (heading[1] === '2' || heading[1] === '3')) toc.push({ depth: Number(heading[1]) as 2 | 3, id, text });
      return;
    }
    if (node.tagName === 'a') {
      const href = String(node.properties?.href ?? '');
      if (href.startsWith('anipy-ref:')) {
        // Объект, которого на сайте нет (например, из стороннего пакета), остаётся текстом.
        const target = opts.resolveRef?.(href.slice('anipy-ref:'.length));
        if (target) {
          node.properties = { ...node.properties, href: target };
          return;
        }
        parent.children.splice(index, 1, ...node.children);
        return [SKIP, index];
      }
      const next = rewriteHref(href, opts);
      node.properties = { ...node.properties, href: next };
      if (/^https?:/.test(next)) Object.assign(node.properties, { target: '_blank', rel: 'noopener noreferrer' });
      return;
    }
    if (node.tagName === 'table') {
      // Обёртка встаёт на место таблицы; обход продолжается внутрь таблицы — ссылки в ячейках тоже переписываются.
      parent.children.splice(index, 1, { type: 'element', tagName: 'div', properties: { className: ['table-wrap'] }, children: [node] });
      return;
    }
    if (node.tagName === 'pre' && isElement(node.children[0], 'code')) {
      const code = node.children[0] as Element;
      const cls = ((code.properties?.className as string[] | undefined) ?? []).find((c) => c.startsWith('language-'));
      const lang = cls?.slice('language-'.length) ?? '';
      const value = toString(code).replace(/\n$/, '');
      const at = { node, parent: parent as { children: ElementContent[] } };
      if (lang === 'anipy-api') {
        if (!opts.renderDirective) throw new Error(`::: ${value} in ${opts.file}: no API reference renderer`);
        const directive = opts.renderDirective(value);
        if (directive.toc) toc.push(directive.toc);
        later.push({ ...at, html: directive.html });
      } else {
        later.push({ ...at, html: () => codeFigure(value, lang, opts.labels) });
      }
      return SKIP;
    }
  });

  for (const { node, parent, html } of later) {
    parent.children[parent.children.indexOf(node)] = { type: 'raw', value: await html() } as unknown as ElementContent;
  }

  const html = unified().use(rehypeStringify, { allowDangerousHtml: true }).stringify(tree);
  return { title, html, toc };
};

/** Страница документации из docs/ репозитория SDK. */
export const renderDoc = (source: string, opts: RenderOptions) => render(source, opts, true);

/** Фрагмент markdown внутри страницы — описание объекта API из docstring. */
export const renderFragment = async (source: string, opts: RenderOptions) => (await render(source, opts, false)).html;
