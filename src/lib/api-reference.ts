// Справочник API (#64): объекты директив mkdocstrings (`::: aniliberty.X`), которые
// scripts/api-reference.py извлёк griffe при `npm run sync`, → HTML в стиле сайта.
// Ссылки на объекты — из autorefs в тексте и из аннотаций — ведут на якоря всех страниц справочника.
import { existsSync, readFileSync } from 'node:fs';
import { sdks, type Sdk } from '../data/sdks';
import { docsPages, docsRoot, docUrl } from './mkdocs';
import { renderFragment, type RenderOptions, type TocEntry } from './markdown';

/** Кусок сигнатуры или аннотации: текст или имя со ссылкой по каноническому пути. */
type Seg = string | { t: string; ref: string };
type Item = { name: string | null; annotation: Seg[] | null; description: string; default: string | null };
type Section =
  | { kind: 'text'; text: string }
  | { kind: 'admonition'; title: string; text: string }
  | { kind: 'deprecated'; text: string }
  | { kind: 'examples'; items: [string, string][] }
  | { kind: string; items: Item[] };
type Param = { name: string; kind: string; annotation: Seg[] | null; default: string | null };

export type ApiObject = {
  /** Якорь: путь из директивы, у членов — с их именем через точку. */
  id: string;
  name: string;
  /** Канонический путь (где объект определён). */
  path: string;
  kind: string;
  labels: string[];
  inherited: boolean;
  docstring: Section[];
  source: { file: string; start: number; end: number } | null;
  parameters?: Param[] | null;
  returns?: Seg[] | null;
  bases?: Seg[][];
  annotation?: Seg[] | null;
  value?: string | null;
  members?: ApiObject[];
  /** Только у корня директивы — опции mkdocstrings. */
  heading?: boolean;
  toc?: boolean;
  showBases?: boolean;
};

const loaded = new Map<string, Record<string, ApiObject>>();

const directivesOf = (sdk: Sdk) => {
  const file = `.sdk/api/${sdk.repo.dir}.json`;
  let objects = loaded.get(file);
  if (!objects) {
    if (!existsSync(file)) throw new Error(`${file} is missing: run npm run sync (needs uv for the API reference)`);
    objects = (JSON.parse(readFileSync(file, 'utf8')) as { directives: Record<string, ApiObject> }).directives;
    loaded.set(file, objects);
  }
  return objects;
};

/** Объект директивы `::: ident`; не нашёлся — сборка падает, как `mkdocs build --strict`. */
export const apiObject = (sdk: Sdk, ident: string) => {
  const obj = directivesOf(sdk)[ident];
  if (!obj) throw new Error(`::: ${ident} (${sdk.package}): not in .sdk/api — run npm run sync`);
  return obj;
};

const DIRECTIVE = /^:::[ \t]+(\S+)/gm;

// Индекс якорей языка: путь объекта — из директивы и канонический — → его адреса на сайте.
const indexes = new Map<string, Map<string, { sdk: Sdk; url: string }[]>>();

const refIndex = (lang: string) => {
  let index = indexes.get(lang);
  if (index) return index;
  index = new Map();
  for (const sdk of sdks) {
    for (const page of docsPages(sdk)) {
      const source = readFileSync(`${docsRoot(sdk)}/${page.file}`, 'utf8');
      for (const [, ident] of source.matchAll(DIRECTIVE)) {
        const walk = (obj: ApiObject) => {
          const url = `${docUrl(lang, sdk, page)}#${obj.id}`;
          for (const key of new Set([obj.id, obj.path])) {
            const list = index!.get(key) ?? [];
            if (!list.some((e) => e.sdk === sdk)) list.push({ sdk, url });
            index!.set(key, list);
          }
          obj.members?.forEach(walk);
        };
        walk(apiObject(sdk, ident));
      }
    }
  }
  indexes.set(lang, index);
  return index;
};

/** Адрес объекта API: сначала в справочнике того же SDK, потом у соседей. */
export const resolveRef = (lang: string, from: Sdk, path: string) => {
  const list = refIndex(lang).get(path);
  return (list?.find((e) => e.sdk === from) ?? list?.[0])?.url;
};

export type ApiLabels = {
  sections: Record<string, string>;
  columns: { name: string; type: string; description: string; default: string };
  kinds: Record<string, string>;
  bases: string;
  source: string;
};

export type ApiContext = {
  lang: string;
  sdk: Sdk;
  /** Опции рендера страницы — для описаний из docstring-ов. */
  md: RenderOptions;
  labels: ApiLabels;
  /** Файл репозитория на GitHub со строками. */
  sourceUrl: (file: string, start: number, end: number) => string;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const plain = (segs: Seg[] | null | undefined) => (segs ?? []).map((s) => (typeof s === 'string' ? s : s.t)).join('');

const html = (segs: Seg[] | null | undefined, ctx: ApiContext) =>
  (segs ?? [])
    .map((s) => {
      if (typeof s === 'string') return esc(s);
      const url = resolveRef(ctx.lang, ctx.sdk, s.ref);
      return url ? `<a href="${esc(url)}">${esc(s.t)}</a>` : esc(s.t);
    })
    .join('');

type Part = { html: string; plain: string };

/** Параметры как в Python: `/` после позиционных, `*` перед именованными. */
const paramParts = (params: Param[], ctx: ApiContext): Part[] => {
  const parts: Part[] = [];
  let star = false;
  params.forEach((p, i) => {
    if (p.kind === 'keyword-only' && !star) {
      parts.push({ html: '*', plain: '*' });
      star = true;
    }
    const prefix = p.kind === 'variadic positional' ? '*' : p.kind === 'variadic keyword' ? '**' : '';
    if (prefix === '*') star = true;
    const annotation = p.annotation ? { html: `: ${html(p.annotation, ctx)}`, plain: `: ${plain(p.annotation)}` } : { html: '', plain: '' };
    const eq = p.annotation ? ' = ' : '=';
    const def = p.default !== null ? { html: `${eq}${esc(p.default)}`, plain: `${eq}${p.default}` } : { html: '', plain: '' };
    parts.push({
      html: `${prefix}<span class="api-param">${esc(p.name)}</span>${annotation.html}${def.html}`,
      plain: `${prefix}${p.name}${annotation.plain}${def.plain}`,
    });
    if (p.kind === 'positional-only' && params[i + 1]?.kind !== 'positional-only') parts.push({ html: '/', plain: '/' });
  });
  return parts;
};

/** Сигнатура отдельным блоком, как separate_signature у mkdocstrings; длинная — по параметру на строку. */
const signature = (obj: ApiObject, ctx: ApiContext) => {
  const name = `<span class="api-sig-name">${esc(obj.name)}</span>`;
  if (obj.kind === 'attribute') {
    const ann = obj.annotation ? `: ${html(obj.annotation, ctx)}` : '';
    const value = obj.value != null && obj.value.length <= 80 ? ` = ${esc(obj.value)}` : '';
    return ann || value ? name + ann + value : undefined;
  }
  if (!obj.parameters) return undefined;
  const parts = paramParts(obj.parameters, ctx);
  const returns = obj.kind === 'function' && obj.returns ? { html: ` -&gt; ${html(obj.returns, ctx)}`, plain: ` -> ${plain(obj.returns)}` } : { html: '', plain: '' };
  const oneLine = `${obj.name}(${parts.map((p) => p.plain).join(', ')})${returns.plain}`;
  if (oneLine.length <= 72) return `${name}(${parts.map((p) => p.html).join(', ')})${returns.html}`;
  return `${name}(\n${parts.map((p) => `    ${p.html},`).join('\n')}\n)${returns.html}`;
};

/** Плашки: что это за объект и его метки (async, classmethod, property…). */
const chips = (obj: ApiObject, parentKind: string | undefined, ctx: ApiContext) => {
  const kind = obj.kind === 'function' && parentKind === 'class' ? (obj.labels.includes('property') ? 'property' : 'method') : obj.kind;
  const extra = obj.labels.filter((l) => ['async', 'classmethod', 'staticmethod', 'abstractmethod', 'property'].includes(l) && l !== kind);
  return [kind, ...extra].map((k) => `<span class="api-chip">${esc(ctx.labels.kinds[k] ?? k)}</span>`).join('');
};

const sectionTitle = (kind: string, ctx: ApiContext) => `<p class="api-section-title meta">${esc(ctx.labels.sections[kind] ?? kind)}</p>`;

const table = async (section: { kind: string; items: Item[] }, ctx: ApiContext) => {
  const { columns } = ctx.labels;
  const typed = ['raises', 'warns'].includes(section.kind);
  const named = !typed && section.items.some((i) => i.name);
  const withDefault = section.items.some((i) => i.default !== null);
  const head = [named && columns.name, columns.type, columns.description, withDefault && columns.default].filter(Boolean) as string[];
  const rows = await Promise.all(
    section.items.map(async (item) => {
      const cells = [
        named ? `<td><code>${esc(item.name ?? '')}</code></td>` : '',
        `<td>${item.annotation ? `<code>${html(item.annotation, ctx)}</code>` : ''}</td>`,
        `<td>${item.description ? await renderFragment(item.description, ctx.md) : ''}</td>`,
        withDefault ? `<td>${item.default !== null ? `<code>${esc(item.default)}</code>` : ''}</td>` : '',
      ];
      return `<tr>${cells.join('')}</tr>`;
    }),
  );
  return (
    `<div class="api-section">${sectionTitle(section.kind, ctx)}<div class="table-wrap"><table>` +
    `<thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.join('')}</tbody></table></div></div>`
  );
};

const admonition = async (kind: string, title: string, text: string, ctx: ApiContext) =>
  `<aside class="admonition admonition-${esc(kind)}"><p class="admonition-title">${esc(title)}</p>${await renderFragment(text, ctx.md)}</aside>`;

const sections = async (obj: ApiObject, ctx: ApiContext) => {
  const out: string[] = [];
  for (const section of obj.docstring) {
    if (section.kind === 'text') out.push(await renderFragment((section as { text: string }).text, ctx.md));
    else if (section.kind === 'admonition') {
      const { title, text } = section as { title: string; text: string };
      out.push(await admonition(title.toLowerCase().replace(/\W+/g, '-'), title, text, ctx));
    } else if (section.kind === 'deprecated') {
      out.push(await admonition('deprecated', ctx.labels.sections.deprecated, (section as { text: string }).text, ctx));
    } else if (section.kind === 'examples') {
      const items = (section as { items: [string, string][] }).items;
      const parts = await Promise.all(items.map(([kind, text]) => renderFragment(kind === 'examples' ? '```pycon\n' + text + '\n```' : text, ctx.md)));
      out.push(`<div class="api-section">${sectionTitle('examples', ctx)}${parts.join('')}</div>`);
    } else out.push(await table(section as { kind: string; items: Item[] }, ctx));
  }
  return out.join('');
};

/** Объект справочника: заголовок с плашками, сигнатура, базы, docstring, исходник и члены. */
const renderObject = async (obj: ApiObject, level: number, ctx: ApiContext, parentKind?: string, showBases = true): Promise<string> => {
  const root = parentKind === undefined;
  const heading = root ? obj.heading !== false : true;
  const tag = `h${Math.min(level, 6)}`;
  const parts: string[] = [`<section class="api api-${esc(obj.kind)}" id="${esc(obj.id)}">`];
  if (heading) {
    parts.push(`<${tag} class="api-head"><code class="api-name">${esc(root ? obj.id : obj.name)}</code><span class="api-chips">${chips(obj, parentKind, ctx)}</span></${tag}>`);
    const sig = signature(obj, ctx);
    if (sig) parts.push(`<pre class="api-sig"><code>${sig}</code></pre>`);
    if (obj.kind === 'class' && showBases && obj.bases?.length) {
      parts.push(`<p class="api-bases"><span class="meta">${esc(ctx.labels.bases)}</span> ${obj.bases.map((b) => `<code>${html(b, ctx)}</code>`).join(', ')}</p>`);
    }
  }
  parts.push(`<div class="api-doc">${await sections(obj, ctx)}`);
  if (heading && obj.source) {
    const { file, start, end } = obj.source;
    parts.push(`<a class="api-source meta" href="${esc(ctx.sourceUrl(file, start, end))}" target="_blank" rel="noopener noreferrer">${esc(ctx.labels.source)} ↗</a>`);
  }
  parts.push('</div>');
  if (obj.members?.length) {
    const next = heading ? level + 1 : level;
    const members = [];
    for (const member of obj.members) members.push(await renderObject(member, next, ctx, obj.kind, showBases));
    parts.push(`<div class="api-members">${members.join('')}</div>`);
  }
  parts.push('</section>');
  return parts.join('');
};

/** Директива `::: ident` на странице: пункт оглавления (корень с заголовком) и HTML объекта. */
export const directive = (ident: string, ctx: ApiContext): { toc?: TocEntry; html: () => Promise<string> } => {
  const obj = apiObject(ctx.sdk, ident);
  const toc = obj.heading !== false && obj.toc !== false ? { depth: 2 as const, id: obj.id, text: obj.name } : undefined;
  return { toc, html: () => renderObject(obj, 2, ctx, undefined, obj.showBases !== false) };
};
