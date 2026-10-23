// Тема Shiki в оттенках серого из макета: роль токена передаётся яркостью и курсивом, не цветом.
// Значения дублируют tokens.css — Shiki красит инлайном, CSS-переменные ему недоступны;
// для подсветки в покрытии API lib/highlight.ts переводит эти цвета в классы .hl-*.
export const grayscale = {
  name: 'anipy-grayscale',
  type: 'dark' as const,
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#f5f5f5',
  },
  tokenColors: [
    { scope: ['keyword', 'storage', 'constant.language', 'support.type.python'], settings: { foreground: '#b3b3b3' } },
    { scope: ['constant.numeric', 'constant.language.json'], settings: { foreground: '#d9d9d9', fontStyle: 'italic' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#a6a6a6' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#8c8c8c' } },
    // JSON: ключи — ярче всего, скобки и разделители — тише всего.
    { scope: ['support.type.property-name', 'support.type.property-name punctuation.definition.string'], settings: { foreground: '#f5f5f5' } },
    {
      scope: ['punctuation.separator', 'punctuation.definition.dictionary', 'punctuation.definition.array'],
      settings: { foreground: '#8c8c8c' },
    },
  ],
};
