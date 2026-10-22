// Разбор CHANGELOG.md в формате Keep a Changelog, который генерирует git-cliff в репозиториях SDK:
// `## [1.0.0](ссылка) - 2026-10-16`, затем `### Added` и пункты `- …`.

export type Kind = 'breaking' | 'added' | 'changed' | 'fixed';

export type Release = {
  version: string;
  date: string;
  sections: { kind: Kind; items: string[] }[];
};

const kinds: Record<string, Kind> = {
  'breaking changes': 'breaking',
  added: 'added',
  changed: 'changed',
  fixed: 'fixed',
};

/** Пункт без markdown-разметки: ссылки → текст, без обратных кавычек. */
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim();

export const parseChangelog = (md: string): Release[] => {
  const releases: Release[] = [];
  let section: Release['sections'][number] | undefined;

  // Клоны на Windows приходят с CRLF.
  for (const line of md.split(/\r?\n/)) {
    const release = line.match(/^## \[([^\]]+)\](?:\([^)]*\))?\s*-\s*(\d{4}-\d{2}-\d{2})/);
    if (release) {
      releases.push({ version: release[1], date: release[2], sections: [] });
      section = undefined;
      continue;
    }
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      const kind = kinds[heading[1].trim().toLowerCase()];
      section = kind ? { kind, items: [] } : undefined;
      if (section) releases.at(-1)?.sections.push(section);
      continue;
    }
    const item = line.match(/^- (.+)$/);
    if (item && section) {
      section.items.push(plain(item[1]));
    } else if (/^\s{2,}\S/.test(line) && section?.items.length) {
      // Перенос длинного пункта на следующую строку.
      section.items[section.items.length - 1] += ' ' + plain(line);
    }
  }
  return releases;
};
