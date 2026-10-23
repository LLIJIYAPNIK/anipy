// Таблица покрытия API — единственный остров сайта: фильтры, поиск, раскрытие строк.
// Подробности операций грузятся одним JSON при первом раскрытии.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { CoverageDetail, CoverageRow } from '../lib/coverage';
import './CoverageTable.css';

type Labels = Record<
  | 'status' | 'all' | 'covered' | 'notCovered' | 'access' | 'anyAccess' | 'public' | 'account' | 'search'
  | 'shown' | 'colPath' | 'colSdk' | 'colAccess' | 'authYes' | 'authNo' | 'dup' | 'ads' | 'empty'
  | 'expandAll' | 'collapseAll' | 'loading' | 'failed' | 'params' | 'noParams' | 'body' | 'responses'
  | 'exampleValue' | 'example' | 'signature' | 'args' | 'returns' | 'raises' | 'sdkLang' | 'copy' | 'copied',
  string
>;

type Props = {
  rows: CoverageRow[];
  groups: { key: string; label: string }[];
  labels: Labels;
  detailsUrl: string;
  sdkPackage: string;
};

type StatusFilter = 'all' | 'ok' | 'not';
type AuthFilter = 'all' | 'public' | 'account';

/** Длительность раскрытия из --expand-duration в мс; при reduced motion — 0.
 *  Минификатор CSS в сборке пишет 420ms как .42s — учитываем единицы. */
const expandMs = () => {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--expand-duration').trim();
  const n = parseFloat(value) || 0;
  return value.endsWith('ms') ? n : value.endsWith('s') ? n * 1000 : n;
};

/** Код с подсветкой из сборки (lib/highlight.ts), без неё — как текст. */
const Code = ({ html, text, class: cls }: { html?: string; text: string; class: string }) =>
  html ? <pre class={cls} dangerouslySetInnerHTML={{ __html: html }} /> : <pre class={cls}>{text}</pre>;

const panelId = (key: string) => 'op-' + key.replace(/[^a-z0-9]+/gi, '-');

function CopyButton({ text, labels }: { text: string; labels: Labels }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      class={`cov-copy${done ? ' is-done' : ''}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5" y="5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.1" />
        <path d="M11 5V2H2v9h3" fill="none" stroke="currentColor" stroke-width="1.1" />
      </svg>
      <span aria-live="polite">{done ? labels.copied : labels.copy}</span>
    </button>
  );
}

function Detail({ row, detail, labels, sdkPackage }: { row: CoverageRow; detail: CoverageDetail; labels: Labels; sdkPackage: string }) {
  const api = detail.api;
  const note = row.status === 'dup' ? labels.dup : row.status === 'ads' ? labels.ads : undefined;
  return (
    <>
      {api && (
        <div class="cov-apicol">
          <div class="cov-api-head">
            <span class="cov-meta">API · {api.tag}</span>
            <h4 lang="ru">{api.summary}</h4>
            {api.description && <p lang="ru" class="cov-api-desc">{api.description}</p>}
          </div>

          <div>
            <h5>{labels.params}</h5>
            {api.params.length ? (
              <div class="cov-table">
                {api.params.map((p) => (
                  <div class="cov-param">
                    <div class="cov-param-name">
                      <span class="cov-code-lg">
                        {p.name}
                        {p.required && <span class="cov-muted"> *</span>}
                      </span>
                      <span class="cov-param-type">
                        {p.type}
                        <br />({p.in})
                      </span>
                    </div>
                    <div class="cov-param-desc">
                      <span lang="ru">{p.desc || '—'}</span>
                      {p.example && (
                        <span class="cov-param-example">
                          <em>{labels.example.toUpperCase()}</em> <code>{p.example}</code>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p class="cov-empty-note">{labels.noParams}</p>
            )}
          </div>

          {api.body && (
            <div>
              <h5>
                {labels.body} · <span class="cov-muted">{api.body.type}</span>
              </h5>
              <div class="cov-table">
                {api.body.props.map((p) => (
                  <div class="cov-param cov-body-prop">
                    <span class="cov-code">
                      {p.name}
                      {p.required && <span class="cov-muted"> *</span>} <span class="cov-type">{p.type}</span>
                    </span>
                    <span lang="ru" class="cov-body-desc">{p.desc || '—'}</span>
                  </div>
                ))}
              </div>
              {api.body.example && <Code class="cov-pre cov-pre-sm" html={detail.html?.bodyExample} text={api.body.example} />}
            </div>
          )}

          <div>
            <h5>{labels.responses}</h5>
            <div class="cov-table">
              {api.responses.map((r) => (
                <div class="cov-response">
                  <span class={`cov-code-num${r.code.startsWith('2') ? ' is-ok' : ''}`}>{r.code}</span>
                  <span lang="ru">{r.desc || '—'}</span>
                  <span class="cov-type">{r.type}</span>
                </div>
              ))}
            </div>
          </div>

          {api.example && (
            <figure class="cov-figure">
              <figcaption>
                <span class="cov-h5">
                  {labels.exampleValue} · <span class="cov-muted">{api.okCode}</span>
                </span>
                <CopyButton text={api.example} labels={labels} />
              </figcaption>
              <Code class="cov-pre cov-pre-scroll" html={detail.html?.example} text={api.example} />
            </figure>
          )}
        </div>
      )}

      <div class="cov-sdkcol">
        <span class="cov-meta">
          SDK · {sdkPackage} {labels.sdkLang && <span class="cov-dim">{labels.sdkLang}</span>}
        </span>
        {note && <p class="cov-sdk-note">{note}</p>}
        {detail.sdk.map((m, n) => {
          const sig = m.sig;
          const html = detail.html?.sdk[n];
          return (
            <div lang="en" class="cov-method">
              <h4 class="cov-method-call">{m.call}</h4>
              <p class="cov-method-summary">{m.summary}</p>
              <figure class="cov-figure">
                <figcaption>
                  <span class="cov-meta">
                    {labels.signature.toUpperCase()} · {m.cls}
                  </span>
                  <CopyButton text={sig} labels={labels} />
                </figcaption>
                <Code class="cov-pre cov-pre-wrap" html={html?.sig} text={sig} />
              </figure>
              {m.args.length > 0 && (
                <div>
                  <h5>{labels.args}</h5>
                  {m.args.map(([name, desc]) => (
                    <div class="cov-arg">
                      <code>{name}</code>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.returns && (
                <div>
                  <h5>{labels.returns}</h5>
                  <p class="cov-returns">{m.returns}</p>
                </div>
              )}
              {m.raises.length > 0 && (
                <div>
                  <h5>{labels.raises}</h5>
                  {m.raises.map(([name, desc]) => (
                    <div class="cov-arg cov-raise">
                      <code>{name}</code>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.example && (
                <figure class="cov-figure">
                  <figcaption>
                    <span class="cov-h5">{labels.example}</span>
                    <CopyButton text={m.example} labels={labels} />
                  </figcaption>
                  <Code class="cov-pre" html={html?.example} text={m.example} />
                </figure>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function CoverageTable({ rows, groups, labels, detailsUrl, sdkPackage }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [auth, setAuth] = useState<AuthFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, CoverageDetail> | null>(null);
  const [failed, setFailed] = useState(false);

  // Подробности — при первом раскрытии.
  useEffect(() => {
    if (!open.size || details || failed) return;
    fetch(detailsUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDetails)
      .catch(() => setFailed(true));
  }, [open.size]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || (status === 'ok') === (r.status === 'ok')) &&
        (auth === 'all' || (auth === 'account') === r.auth) &&
        (!q || `${r.method} ${r.path} ${r.calls.join(' ')}`.toLowerCase().includes(q)),
    );
  }, [rows, status, auth, query]);

  // Сворачиваемая строка остаётся в DOM, пока играет анимация, — потом убирается.
  const [closing, setClosing] = useState<Set<string>>(new Set());
  // Свой таймер на каждую строку: повторное раскрытие его отменяет, новое закрытие —
  // перезапускает. Иначе таймер первого закрытия оборвал бы анимацию второго.
  const closeTimers = useRef(new Map<string, number>());

  const without = (set: Set<string>, keys: string[]) => new Set([...set].filter((k) => !keys.includes(k)));

  const cancelClose = (key: string) => {
    clearTimeout(closeTimers.current.get(key));
    closeTimers.current.delete(key);
  };

  const close = (keys: string[]) => {
    if (!keys.length) return;
    setClosing((prev) => new Set([...prev, ...keys]));
    const ms = expandMs();
    for (const key of keys) {
      cancelClose(key);
      closeTimers.current.set(
        key,
        window.setTimeout(() => {
          closeTimers.current.delete(key);
          setOpen((prev) => without(prev, [key]));
          setClosing((prev) => without(prev, [key]));
        }, ms),
      );
    }
  };

  const reopen = (keys: string[]) => {
    for (const key of keys) cancelClose(key);
    setClosing((prev) => without(prev, keys));
  };

  const toggle = (key: string) => {
    if (closing.has(key)) reopen([key]);
    else if (open.has(key)) close([key]);
    else setOpen((prev) => new Set([...prev, key]));
  };

  // Таймеры не переживают таблицу.
  useEffect(() => () => closeTimers.current.forEach((id) => clearTimeout(id)), []);

  const chips = <T extends string>(label: string, value: T, set: (v: T) => void, options: [T, string][]) => (
    <div role="group" aria-label={label} class="cov-chips">
      {options.map(([v, text]) => (
        <button type="button" aria-pressed={value === v} class="cov-chip" onClick={() => set(v)}>
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <div class="cov">
      <div class="cov-controls">
        <div class="cov-filters">
          {chips(labels.status, status, setStatus, [
            ['all', labels.all],
            ['ok', labels.covered],
            ['not', labels.notCovered],
          ])}
          {chips(labels.access, auth, setAuth, [
            ['all', labels.anyAccess],
            ['public', labels.public],
            ['account', labels.account],
          ])}
        </div>
        <label class="cov-search">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.2" />
            <path d="M11 11l4 4" stroke="currentColor" stroke-width="1.2" />
          </svg>
          <span class="visually-hidden">{labels.search}</span>
          <input
            type="search"
            placeholder="releases, /torrents, ratings…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </label>
      </div>

      <div class="cov-summary">
        <span aria-live="polite" class="cov-shown">
          {labels.shown.replace('{n}', String(visible.length)).replace('{total}', String(rows.length))}
        </span>
        <div class="cov-tools">
          <button type="button" class="cov-tool" onClick={() => {
              reopen([...closing]);
              setOpen(new Set(visible.map((r) => r.key)));
            }}>
            {labels.expandAll}
          </button>
          <button type="button" class="cov-tool" onClick={() => close([...open])}>
            {labels.collapseAll}
          </button>
        </div>
      </div>

      <div class="cov-list">
        <div aria-hidden="true" class="cov-row cov-head">
          <span>HTTP</span>
          <span>{labels.colPath}</span>
          <span class="cov-hide-sm">{labels.colSdk}</span>
          <span class="cov-hide-sm">{labels.colAccess}</span>
          <span></span>
        </div>

        {visible.length === 0 && <p class="cov-empty">{labels.empty}</p>}

        {groups.map((g) => {
          const groupRows = visible.filter((r) => r.group === g.key);
          if (!groupRows.length) return null;
          return (
            <section key={g.key}>
              <h2 class="cov-group">
                <span>{g.label}</span>
                <span class="cov-group-count">{groupRows.length}</span>
              </h2>
              {groupRows.map((r) => {
                const isClosing = closing.has(r.key);
                const isOpen = open.has(r.key) && !isClosing;
                const note = r.status === 'dup' ? labels.dup : r.status === 'ads' ? labels.ads : undefined;
                const detail = details?.[r.key];
                return (
                  <div class={`cov-op${open.has(r.key) ? ' is-open' : ''}`} key={r.key}>
                    <h3>
                      <button type="button" aria-expanded={isOpen} aria-controls={panelId(r.key)} class="cov-row" onClick={() => toggle(r.key)}>
                        <span>
                          <span class={`cov-method-badge${r.status !== 'ok' ? ' is-off' : ''}`}>{r.method}</span>
                        </span>
                        <span class="cov-path">{r.path}</span>
                        <span class="cov-hide-sm cov-calls">
                          {r.calls.map((c) => (
                            <span class="cov-code">{c}</span>
                          ))}
                          {note && <span class="cov-note">{note}</span>}
                        </span>
                        <span class={`cov-hide-sm cov-auth${r.auth ? ' is-account' : ''}`}>{r.auth ? labels.authYes : labels.authNo}</span>
                        <span aria-hidden="true" class="cov-plus">
                          <svg width="12" height="12" viewBox="0 0 12 12">
                            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.1" fill="none" />
                          </svg>
                        </span>
                      </button>
                    </h3>
                    {open.has(r.key) && (
                      <div class={`cov-panel-wrap${isClosing ? ' is-closing' : ''}`}>
                      <div class="cov-panel-inner">
                      <div id={panelId(r.key)} class="cov-panel">
                        {failed ? (
                          <p class="cov-empty-note">{labels.failed}</p>
                        ) : !details ? (
                          <p class="cov-empty-note">{labels.loading}</p>
                        ) : detail ? (
                          <Detail row={r} detail={detail} labels={labels} sdkPackage={sdkPackage} />
                        ) : null}
                      </div>
                      </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
