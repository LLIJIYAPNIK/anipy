// Достаёт из README SDK то, что показывает страница документации.
// Опирается на общую структуру README: разделы `## Installation` и `## Quickstart`.

/** Текст раздела `## <title>` до следующего заголовка второго уровня. */
const section = (md: string, title: string) => {
  const match = md.match(new RegExp(`^## ${title}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  return match?.[1] ?? '';
};

/** Содержимое fenced-блоков нужного языка. */
const codeBlocks = (md: string, lang: string) =>
  [...md.matchAll(new RegExp('^```' + lang + '\\s*\\n([\\s\\S]*?)^```', 'gm'))].map((m) => m[1].trimEnd());

export type ReadmeParts = {
  /** Команды установки из bash-блоков раздела Installation. */
  install: string[];
  /** Первый python-блок раздела Quickstart. */
  quickstart?: string;
};

export const readmeParts = (raw: string): ReadmeParts => {
  // Клоны на Windows приходят с CRLF.
  const md = raw.replace(/\r\n/g, '\n');
  return {
    install: codeBlocks(section(md, 'Installation'), 'bash'),
    quickstart: codeBlocks(section(md, 'Quickstart'), 'python')[0],
  };
};
