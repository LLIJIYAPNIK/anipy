// Разбор docs/endpoints.md SDK: таблица «Method | Path | Tag | Description | Auth | SDK method | Phase».

export type Status = 'ok' | 'dup' | 'ads';

export type Endpoint = {
  method: string;
  path: string;
  tag: string;
  description: string;
  auth: boolean;
  /** Вызовы SDK без обратных кавычек, например `client.genres.list()`. */
  calls: string[];
  status: Status;
};

const unquote = (s: string) => s.replace(/`/g, '').trim();

export const parseEndpoints = (raw: string) => {
  const md = raw.replace(/\r\n/g, '\n');
  const endpoints: Endpoint[] = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const [method, path, tag, description, auth, sdk] = line.split('|').slice(1, -1).map((c) => c.trim());
    const calls = [...sdk.matchAll(/`(client\.[^`]+)`/g)].map((m) => m[1]);
    const status: Status = calls.length ? 'ok' : /\bads\b/.test(sdk) ? 'ads' : 'dup';
    endpoints.push({ method: unquote(method), path: unquote(path), tag, description, auth: auth === 'yes', calls, status });
  }
  // «snapshot of 2026-10-16» в шапке файла.
  const snapshot = md.match(/snapshot of (\d{4}-\d{2}-\d{2})/)?.[1];
  return { endpoints, snapshot };
};
