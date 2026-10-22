import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://anipy.ru',
  output: 'static',
  // Ссылки на страницы пишутся со слешем; 'always' в dev ломает /data/*.json.
  trailingSlash: 'ignore',
  integrations: [preact()],
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: true },
  },
  redirects: {
    '/': '/ru/',
  },
});
