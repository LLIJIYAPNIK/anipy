// Подсветка кода для покрытия API на этапе сборки: Shiki с темой в оттенках серого,
// но вместо инлайн-стилей — короткие классы .hl-* (CoverageTable.css): JSON с подробностями
// не раздувается, а цвета остаются токенами.
import { createHighlighter, type Highlighter } from 'shiki';
import { grayscale } from './grayscale-theme';

export type Lang = 'json' | 'python';

const classes: Record<string, string> = {
  '#f5f5f5': 'hl-ink',
  '#d9d9d9': 'hl-soft',
  '#b3b3b3': 'hl-ter',
  '#a6a6a6': 'hl-sec',
  '#8c8c8c': 'hl-mut',
};

let highlighter: Promise<Highlighter> | undefined;
const getHighlighter = () => (highlighter ??= createHighlighter({ themes: [grayscale], langs: ['json', 'python'] }));

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML строк кода для <pre>: токены в <span class="hl-…">, курсив — .hl-i.
 *  Соседние токены одного вида склеиваются, основной цвет — без обёртки (его даёт <pre>). */
export const highlight = async (code: string, lang: Lang) => {
  const { tokens } = (await getHighlighter()).codeToTokens(code, { lang, theme: grayscale.name });
  return tokens
    .map((line) => {
      const runs: { cls: string; text: string }[] = [];
      for (const token of line) {
        const names = [classes[(token.color ?? '').toLowerCase()] ?? 'hl-ink'];
        if (token.fontStyle && token.fontStyle & 1) names.push('hl-i');
        const cls = names.join(' ');
        const last = runs.at(-1);
        if (last && last.cls === cls) last.text += token.content;
        else runs.push({ cls, text: token.content });
      }
      return runs.map(({ cls, text }) => (cls === 'hl-ink' ? escape(text) : `<span class="${cls}">${escape(text)}</span>`)).join('');
    })
    .join('\n');
};
