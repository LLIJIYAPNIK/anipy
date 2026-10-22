// Подробности операции из spec/openapi.json SDK для раскрытой строки таблицы покрытия.

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Param = { name: string; in: string; type: string; required: boolean; desc: string; example?: string };
export type BodyProp = { name: string; type: string; required: boolean; desc: string };

export type OperationDetail = {
  tag: string;
  summary: string;
  description?: string;
  params: Param[];
  body?: { type: string; props: BodyProp[]; example?: string };
  responses: { code: string; desc: string; type: string }[];
  /** Пример ответа 2xx, собранный из схемы. */
  example?: string;
  okCode?: string;
};

const resolve = (spec: Json, node: Json): Json => {
  let current = node;
  for (let i = 0; current?.$ref && i < 20; i++) {
    current = current.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((acc: Json, key: string) => acc?.[key], spec);
  }
  return current ?? {};
};

const typeOf = (spec: Json, schema: Json): string => {
  const s = resolve(spec, schema);
  if (s.type === 'array') return `array<${typeOf(spec, s.items)}>`;
  if (s.type) return s.format ? `${s.type} (${s.format})` : s.type;
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).map((x: Json) => typeOf(spec, x)).join(' | ');
  if (s.allOf || s.properties) return 'object';
  return 'any';
};

/** Пример значения по схеме: явные example, иначе заглушка по типу. Глубина ограничена. */
const exampleOf = (spec: Json, schema: Json, depth = 0): Json => {
  const s = resolve(spec, schema);
  if (s.example !== undefined) return s.example;
  if (depth > 6) return null;
  if (s.allOf) return Object.assign({}, ...s.allOf.map((x: Json) => exampleOf(spec, x, depth + 1)));
  if (s.oneOf || s.anyOf) return exampleOf(spec, (s.oneOf ?? s.anyOf)[0], depth + 1);
  if (s.type === 'array') return [exampleOf(spec, s.items, depth + 1)];
  if (s.type === 'object' || s.properties) {
    return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, exampleOf(spec, v, depth + 1)]));
  }
  if (s.enum) return s.enum[0];
  return { string: 'string', integer: 0, number: 0, boolean: false }[s.type as string] ?? null;
};

const stringify = (value: Json) => {
  const text = JSON.stringify(value, null, 2);
  return text && text !== 'null' && text !== '{}' ? text : undefined;
};

export const operationDetail = (spec: Json, method: string, path: string): OperationDetail | undefined => {
  const item = spec.paths?.[path];
  const op = item?.[method.toLowerCase()];
  if (!op) return undefined;

  const params: Param[] = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((raw: Json) => {
    const p = resolve(spec, raw);
    const example = p.example ?? resolve(spec, p.schema).example;
    return {
      name: p.name,
      in: p.in,
      type: typeOf(spec, p.schema),
      required: !!p.required,
      desc: p.description ?? '',
      example: example === undefined ? undefined : typeof example === 'string' ? example : JSON.stringify(example),
    };
  });

  let body: OperationDetail['body'];
  if (op.requestBody) {
    const rb = resolve(spec, op.requestBody);
    const [type, media] = Object.entries(rb.content ?? {})[0] ?? [];
    if (type) {
      const schema = resolve(spec, (media as Json).schema);
      const required: string[] = schema.required ?? [];
      body = {
        type,
        props: Object.entries(schema.properties ?? {}).map(([name, v]) => ({
          name,
          type: typeOf(spec, v),
          required: required.includes(name),
          desc: resolve(spec, v).description ?? '',
        })),
        example: stringify(exampleOf(spec, schema)),
      };
    }
  }

  const responses = Object.entries(op.responses ?? {}).map(([code, raw]) => {
    const r = resolve(spec, raw);
    return { code, desc: r.description ?? '', type: Object.keys(r.content ?? {})[0] ?? '' };
  });

  const ok = Object.entries(op.responses ?? {}).find(([code]) => code.startsWith('2'));
  let example: string | undefined;
  let okCode: string | undefined;
  if (ok) {
    const r = resolve(spec, ok[1]);
    const [type, media] = Object.entries(r.content ?? {})[0] ?? [];
    if (type === 'application/json') example = stringify(exampleOf(spec, (media as Json).schema));
    okCode = [ok[0], type].filter(Boolean).join(' · ');
  }

  return {
    tag: op.tags?.[0] ?? '',
    summary: op.summary ?? '',
    description: op.description && op.description !== op.summary ? op.description : undefined,
    params,
    body,
    responses,
    example,
    okCode,
  };
};
