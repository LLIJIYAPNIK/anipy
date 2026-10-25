// /changelog.xml — Atom-лента релизов всех SDK (#70) из их CHANGELOG.md. Одна на оба языка:
// записи изменений в репозиториях — на английском.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sdks, sdkDir } from '../data/sdks';
import { parseChangelog, type Kind } from '../lib/changelog';

// Последние релизы каждого SDK — читателю ленты старее не нужны.
const perSdk = 10;
const kindTitle: Record<Kind, string> = { breaking: 'Breaking changes', added: 'Added', changed: 'Changed', fixed: 'Fixed' };

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://anipy.ru');
  const files = await getCollection('sdkDocs', (e) => e.filePath?.endsWith('/CHANGELOG.md'));
  const entries = sdks
    .flatMap((sdk) => {
      const body = files.find((e) => e.filePath === `${sdkDir(sdk)}/CHANGELOG.md`)?.body ?? '';
      return parseChangelog(body)
        .slice(0, perSdk)
        .map((release) => ({ sdk, release }));
    })
    .sort((a, b) => b.release.date.localeCompare(a.release.date) || a.sdk.package.localeCompare(b.sdk.package));

  const updated = `${entries[0]?.release.date ?? '1970-01-01'}T00:00:00Z`;
  const body = entries
    .map(({ sdk, release }) => {
      const url = new URL(`/en/changelog/#${sdk.package}`, base).href;
      const html = release.sections
        .map((s) => `<h3>${xml(kindTitle[s.kind])}</h3><ul>${s.items.map((i) => `<li>${xml(i)}</li>`).join('')}</ul>`)
        .join('');
      return `  <entry>
    <id>tag:anipy.ru,2026:${sdk.package}/${xml(release.version)}</id>
    <title>${xml(`${sdk.package} ${release.version}`)}</title>
    <updated>${release.date}T00:00:00Z</updated>
    <link rel="alternate" href="${xml(url)}"/>
    <category term="${xml(sdk.package)}"/>
    <content type="html">${xml(html)}</content>
  </entry>`;
    })
    .join('\n');

  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${new URL('/changelog.xml', base).href}</id>
  <title>ANIPY — SDK releases</title>
  <subtitle>Python SDKs for anime, manga and light novels: py-aniliberty, ranobelib-python-sdk, mangalib-python-sdk.</subtitle>
  <link rel="self" href="${new URL('/changelog.xml', base).href}"/>
  <link rel="alternate" href="${new URL('/en/changelog/', base).href}"/>
  <icon>${new URL('/logo.png', base).href}</icon>
  <updated>${updated}</updated>
  <author><name>LLIJIYAPNIK</name></author>
${body}
</feed>
`;
  return new Response(feed, { headers: { 'content-type': 'application/atom+xml; charset=utf-8' } });
};
