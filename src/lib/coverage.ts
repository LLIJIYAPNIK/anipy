// Данные страницы покрытия API из клона SDK в .sdk/: таблица endpoints.md,
// подробности операций из OpenAPI и методов SDK — из данных griffe (lib/api-reference.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sdkDir, type Sdk } from '../data/sdks';
import { groupForTag, type GroupKey } from '../data/coverage-groups';
import { parseEndpoints, type Status } from './endpoints';
import { operationDetail, type OperationDetail } from './openapi';
import { apiClasses, type ApiClass } from './api-reference';
import { highlight } from './highlight';

export type CoverageRow = {
  key: string;
  method: string;
  path: string;
  group: GroupKey;
  auth: boolean;
  calls: string[];
  status: Status;
};

/** html — тот же код с подсветкой (lib/highlight.ts); текст остаётся для копирования. */
export type CoverageDetail = {
  api?: OperationDetail;
  sdk: MethodDoc[];
  html: { example?: string; bodyExample?: string; sdk: { sig: string; example?: string }[] };
};

export type MethodDoc = {
  call: string;
  cls: string;
  sig: string;
  summary: string;
  args: [string, string][];
  returns?: string;
  raises: [string, string][];
  example?: string;
};

/** Длинная сигнатура — по аргументу на строку, как в макете. */
export const formatSig = (sig: string) => {
  const open = sig.indexOf('(');
  const close = sig.lastIndexOf(')');
  if (open < 0 || close < open || sig.length <= 72) return sig;
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of sig.slice(open + 1, close)) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return sig.slice(0, open + 1) + '\n' + parts.map((p) => `    ${p},`).join('\n') + '\n' + sig.slice(close);
};

/** Документация вызова `client.a.b.method()`: по атрибутам-ресурсам от класса клиента. */
const methodDoc = (classes: Record<string, ApiClass>, root: string, call: string): MethodDoc | undefined => {
  const parts = call.replace(/\(\)$/, '').split('.').slice(1);
  let cls = root;
  for (const attr of parts.slice(0, -1)) {
    const next = classes[cls]?.attrs[attr];
    if (!next) return undefined;
    cls = next;
  }
  const method = classes[cls]?.methods[parts.at(-1)!];
  if (!method) return undefined;
  return {
    call,
    cls: classes[cls].name,
    sig: formatSig(method.sig),
    summary: method.summary,
    args: method.args,
    returns: method.returns ?? undefined,
    raises: method.raises,
    example: method.example ?? undefined,
  };
};

const read = (path: string) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

export const loadCoverage = (sdk: Sdk) => {
  if (!sdk.coverage) return undefined;
  const base = sdkDir(sdk);
  const md = read(join(base, sdk.coverage.endpoints));
  if (!md) return undefined;

  const { endpoints, snapshot } = parseEndpoints(md);
  const rows: CoverageRow[] = endpoints.map((e) => ({
    key: `${e.method} ${e.path}`,
    method: e.method,
    path: e.path,
    group: groupForTag(e.tag) ?? 'app',
    auth: e.auth,
    calls: e.calls,
    status: e.status,
  }));

  const stats = {
    total: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    dup: rows.filter((r) => r.status === 'dup').length,
    ads: rows.filter((r) => r.status === 'ads').length,
  };

  return { rows, stats, snapshot };
};

/** Подробности всех операций — отдельным JSON, его грузит таблица при первом раскрытии. */
export const loadCoverageDetails = async (sdk: Sdk): Promise<Record<string, CoverageDetail>> => {
  const coverage = loadCoverage(sdk);
  if (!coverage || !sdk.coverage) return {};
  const base = sdkDir(sdk);
  const specText = read(join(base, sdk.coverage.spec));
  const spec = specText ? JSON.parse(specText) : undefined;
  const classes = apiClasses(sdk);
  // Корень — класс клиента: у него больше всего атрибутов-ресурсов.
  const root = Object.entries(classes).sort((a, b) => Object.keys(b[1].attrs).length - Object.keys(a[1].attrs).length)[0]?.[0] ?? '';

  const maybe = (code: string | undefined, lang: 'json' | 'python') => (code ? highlight(code, lang) : undefined);
  return Object.fromEntries(
    await Promise.all(
      coverage.rows.map(async (row): Promise<[string, CoverageDetail]> => {
        const api = spec ? operationDetail(spec, row.method, row.path) : undefined;
        const docs = row.calls.map((call) => methodDoc(classes, root, call)).filter((d): d is MethodDoc => !!d);
        return [
          row.key,
          {
            api,
            sdk: docs,
            html: {
              example: await maybe(api?.example, 'json'),
              bodyExample: await maybe(api?.body?.example, 'json'),
              sdk: await Promise.all(
                docs.map(async (m) => ({ sig: await highlight(m.sig, 'python'), example: await maybe(m.example, 'python') })),
              ),
            },
          },
        ];
      }),
    ),
  );
};
