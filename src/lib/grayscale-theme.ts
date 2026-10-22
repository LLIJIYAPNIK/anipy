// Тема Shiki в оттенках серого из макета: ключевые слова светлее, строки и комментарии темнее.
// Значения дублируют tokens.css — Shiki красит инлайном, CSS-переменные ему недоступны.
export const grayscale = {
  name: 'anipy-grayscale',
  type: 'dark' as const,
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#f5f5f5',
  },
  tokenColors: [
    { scope: ['keyword', 'storage', 'constant.language', 'support.type.python'], settings: { foreground: '#b3b3b3' } },
    { scope: ['constant.numeric'], settings: { foreground: '#d9d9d9' } },
    { scope: ['string', 'punctuation.definition.string'], settings: { foreground: '#a6a6a6' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#8c8c8c' } },
  ],
};
