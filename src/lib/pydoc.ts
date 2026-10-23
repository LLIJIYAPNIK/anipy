// Достаёт из исходников SDK классы ресурсов, их методы и docstring-и (Google style),
// чтобы по вызову вида `client.catalog.references.genres()` показать сигнатуру и описание.

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

type PyClass = {
  bases: string[];
  attrs: Record<string, string>;
  methods: Record<string, { sig: string; doc: string }>;
};

/** Классы всех переданных файлов: атрибуты `self.x = Y(...)` и методы с docstring. */
export const parseClasses = (sources: string[]) => {
  const classes: Record<string, PyClass> = {};
  for (const raw of sources) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    let current: PyClass | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cls = line.match(/^class (\w+)(?:\(([^)]*)\))?/);
      if (cls) {
        const bases = (cls[2] ?? '').split(',').map((b) => b.trim().replace(/\[.*$/, '')).filter(Boolean);
        current = classes[cls[1]] = { bases, attrs: {}, methods: {} };
        continue;
      }
      if (!current) continue;
      const attr = line.match(/^ {8}self\.(\w+)(?::\s*[^=]+)? = ([A-Z]\w+)\(/);
      if (attr) current.attrs[attr[1]] = attr[2];

      const def = line.match(/^ {4}(async )?def ([a-z]\w*)\(/);
      if (!def) continue;
      // Сигнатура до двоеточия на нулевой глубине скобок.
      let sig = '';
      let j = i;
      for (; j < lines.length; j++) {
        sig += ' ' + lines[j].trim();
        const depth = [...sig].reduce((d, ch) => d + ('([{'.includes(ch) ? 1 : ')]}'.includes(ch) ? -1 : 0), 0);
        if (depth === 0 && sig.trimEnd().endsWith(':')) break;
      }
      sig = sig
        .trim()
        .replace(/:$/, '')
        .replace(/\(\s+/g, '(')
        .replace(/,?\s*\)/g, ')')
        .replace(/\(self,?\s*/, '(')
        .replace(/\s+/g, ' ');
      // Docstring сразу после сигнатуры.
      let doc = '';
      const first = lines[j + 1]?.trim() ?? '';
      if (first.startsWith('"""')) {
        const body: string[] = [first.slice(3)];
        if (!(first.length > 3 && first.endsWith('"""'))) {
          for (let k = j + 2; k < lines.length; k++) {
            if (lines[k].trim().endsWith('"""')) {
              body.push(lines[k].replace(/"""\s*$/, ''));
              break;
            }
            body.push(lines[k]);
          }
        }
        doc = body
          .map((l) => l.replace(/^ {8}/, ''))
          .join('\n')
          .replace(/"""$/, '')
          .trim();
      }
      current.methods[def[2]] = { sig, doc };
      i = j;
    }
  }
  return classes;
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

const unquote = (s: string) => s.replace(/``/g, '').replace(/\*\*/g, '');

/** Пункты раздела вида `name: описание` с продолжением на следующих строках. */
const entries = (block: string[]): [string, string][] => {
  const out: [string, string][] = [];
  for (const line of block) {
    const m = line.match(/^ {4}(\S[^:]*):\s*(.*)$/);
    if (m) out.push([m[1].trim(), unquote(m[2])]);
    else if (out.length && line.trim()) out[out.length - 1][1] += ' ' + unquote(line.trim());
  }
  return out;
};

const parseDoc = (doc: string) => {
  const sections: Record<string, string[]> = { summary: [] };
  let current = 'summary';
  for (const line of doc.split('\n')) {
    const head = line.match(/^(Args|Returns|Raises|Examples?|Yields|Note|Notes):\s*$/);
    if (head) {
      current = head[1].replace(/s$/, '').replace('Note', 'Notes');
      sections[current] = [];
    } else {
      sections[current].push(line);
    }
  }
  const summary = unquote(sections.summary.join('\n').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim());
  const returns = sections.Return ? unquote(sections.Return.map((l) => l.trim()).join(' ').trim()) : undefined;
  const exampleBlock = (sections.Example ?? []).join('\n');
  const fenced = exampleBlock.match(/```\w*\n([\s\S]*?)```/)?.[1];
  // Снимаем общий отступ, сохраняя вложенность строк.
  const exampleLines = (fenced ?? exampleBlock).split('\n');
  const indent = Math.min(...exampleLines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  const example = exampleLines
    .map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
    .join('\n')
    .trim();
  return {
    summary,
    args: entries(sections.Arg ?? []),
    returns: returns || undefined,
    raises: entries(sections.Raise ?? []),
    example: example || undefined,
  };
};

/** Документация вызова `client.a.b.method()` от корневого класса клиента. */
export const methodDoc = (classes: Record<string, PyClass>, root: string, call: string): MethodDoc | undefined => {
  const parts = call.replace(/\(\)$/, '').split('.').slice(1);
  // Атрибут или метод в классе либо в его базовых классах.
  const lookup = <T,>(name: string, pick: (c: PyClass) => T | undefined, seen = new Set<string>()): T | undefined => {
    if (seen.has(name) || !classes[name]) return undefined;
    seen.add(name);
    return pick(classes[name]) ?? classes[name].bases.map((b) => lookup(b, pick, seen)).find(Boolean);
  };
  let cls = root;
  for (const attr of parts.slice(0, -1)) {
    const next = lookup(cls, (c) => c.attrs[attr]);
    if (!next) return undefined;
    cls = next;
  }
  const method = lookup(cls, (c) => c.methods[parts.at(-1)!]);
  if (!method) return undefined;
  return { call, cls, sig: formatSig(method.sig), ...parseDoc(method.doc) };
};
