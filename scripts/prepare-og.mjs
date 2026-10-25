// Картинки превью ссылок (#69): 1200×630 PNG в стиле сайта — чёрный фон, кана, номер и пакет SDK.
// Usage: node scripts/prepare-og.mjs
// Результат: public/og/anipy.png (весь сайт) и public/og/<ключ>.png — на каждый SDK и общую
// документацию (ядро). Картинки без текста на русском или английском — одна на обе версии сайта.
// Шрифты — те же, что на сайте, с Google Fonts, только нужные символы. Цвета повторяют tokens.css:
// satori рисует без CSS-переменных.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { sdks, sharedDocs, usedBy } from '../src/data/sdks.ts';

const color = { ground: '#000000', divider: '#292929', muted: '#8c8c8c', secondary: '#a6a6a6', ink: '#f5f5f5' };
const out = join('public', 'og');
mkdirSync(out, { recursive: true });

const jpLine = 'アニメ・ラノベ・漫画のための Python SDK コレクション。';
const allText = [jpLine, 'ANIPY anipy ANIME × PYTHON', ...sdks.flatMap((s) => [s.kana, s.number, s.package, s.platform, s.python, s.license]), ...sharedDocs.map((s) => s.id)]
  .join(' ')
  .toUpperCase()
  .concat(' ', [jpLine, ...sdks.map((s) => s.package), ...sharedDocs.map((s) => s.id), 'anipy', 'python'].join(' '))
  // Разделители и цифры строк метаданных.
  .concat(' ·×+.0123456789');

/** TTF шрифта Google Fonts только с нужными символами (без User-Agent браузера отдаётся truetype). */
const font = async (family, weight) => {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent([...new Set(allText)].join(''))}`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!src) throw new Error(`${family} ${weight}: no font in ${css.slice(0, 200)}`);
  return { name: family, weight, style: 'normal', data: await (await fetch(src)).arrayBuffer() };
};

const fonts = await Promise.all([
  font('Shippori Mincho', 800),
  font('Cormorant Garamond', 300),
  font('Cormorant Garamond', 400),
  font('JetBrains Mono', 400),
]);

const logo = `data:image/png;base64,${readFileSync(join('public', 'logo.png')).toString('base64')}`;

/** Элемент для satori: тип, стиль, дети. */
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat() } });
const img = (src, size) => ({ type: 'img', props: { src, width: size, height: size } });
const mono = { fontFamily: 'JetBrains Mono', color: color.muted, fontSize: 20, letterSpacing: 4 };
// Поле картинки — рамка фиксированного размера по центру: у satori content-box, отступы
// рамки прибавились бы к её ширине, а height: 100% считается от всей картинки.
const W = 1200 - 2 * 72;
const H = 630 - 2 * 56;

/** Вертикальная кана — столбиком по символу (writing-mode satori не умеет). */
const vertical = (text, size) =>
  h('div', { flexDirection: 'column', alignItems: 'center', fontFamily: 'Shippori Mincho', fontWeight: 800, fontSize: size, lineHeight: 1.04, color: color.ink }, ...[...text].map((ch) => h('div', {}, ch)));

const brand = h(
  'div',
  { alignItems: 'center', gap: 22 },
  img(logo, 64),
  h('div', { fontFamily: 'Cormorant Garamond', fontWeight: 400, fontSize: 40, letterSpacing: 13, color: color.ink }, 'anipy'),
);

const frame = (...children) =>
  h(
    'div',
    { width: 1200, height: 630, backgroundColor: color.ground, alignItems: 'center', justifyContent: 'center' },
    h('div', { width: W, height: H, justifyContent: 'space-between' }, ...children),
  );

const sdkImage = (sdk) =>
  frame(
    h(
      'div',
      { width: W - 300, height: H, flexDirection: 'column', justifyContent: 'space-between' },
      brand,
      h(
        'div',
        { flexDirection: 'column', gap: 18 },
        h('div', { fontFamily: 'Cormorant Garamond', fontWeight: 300, fontSize: 150, lineHeight: 0.8, color: color.ink }, sdk.number),
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 46, color: color.ink, marginTop: 24 }, sdk.package),
        h('div', mono, `${sdk.platform.toUpperCase()} · PYTHON ${sdk.python} · ${sdk.license}`),
      ),
    ),
    h('div', { width: 300, height: H, justifyContent: 'center', borderLeft: `1px solid ${color.divider}` }, vertical(sdk.kana, sdk.kana.length > 2 ? 156 : 200)),
  );

const sharedImage = (shared) =>
  frame(
    h(
      'div',
      { width: W - 360, height: H, flexDirection: 'column', justifyContent: 'space-between' },
      brand,
      h(
        'div',
        { flexDirection: 'column', gap: 26 },
        h('div', { fontFamily: 'JetBrains Mono', fontSize: 64, color: color.ink }, shared.id),
        h('div', mono, usedBy(shared).map((s) => s.package.toUpperCase()).join(' · ')),
      ),
    ),
    h('div', { width: 360, height: H, justifyContent: 'flex-end', gap: 48 }, ...usedBy(shared).map((s) => vertical(s.kana, 120))),
  );

const siteImage = () =>
  frame(
    h(
      'div',
      { width: W - 480, height: H, flexDirection: 'column', justifyContent: 'space-between' },
      brand,
      h(
        'div',
        { flexDirection: 'column', gap: 26 },
        h('div', { fontFamily: 'Cormorant Garamond', fontWeight: 400, fontSize: 72, letterSpacing: 10, color: color.ink }, 'ANIPY'),
        h('div', { fontFamily: 'Shippori Mincho', fontWeight: 800, fontSize: 26, lineHeight: 1.8, letterSpacing: 2, color: color.secondary }, jpLine),
        h('div', mono, 'ANIME × PYTHON'),
      ),
    ),
    h('div', { width: 480, height: H }, ...sdks.map((s) => h('div', { width: 160, height: H, justifyContent: 'center', alignItems: 'flex-start', borderLeft: `1px solid ${color.divider}` }, vertical(s.kana, 104)))),
  );

const render = async (name, tree) => {
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const file = join(out, `${name}.png`);
  writeFileSync(file, png);
  console.log(`${file}  ${(png.length / 1024).toFixed(0)} KB`);
};

await render('anipy', siteImage());
for (const sdk of sdks) await render(sdk.package, sdkImage(sdk));
for (const shared of sharedDocs) await render(shared.id, sharedImage(shared));
