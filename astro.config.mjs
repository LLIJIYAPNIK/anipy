import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://anipy.ru',
  output: 'static',
  // Ссылки на страницы пишутся со слешем; 'always' в dev ломает /data/*.json.
  trailingSlash: 'ignore',
  integrations: [
    preact(),
    // sitemap-index.xml (#69): обе языковые версии со ссылками друг на друга; без страниц ошибок
    // и без редиректа с корня.
    sitemap({
      i18n: { defaultLocale: 'ru', locales: { ru: 'ru-RU', en: 'en-US' } },
      filter: (page) => /\/(ru|en)\//.test(page),
    }),
  ],
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: { prefixDefaultLocale: true },
  },
  redirects: {
    '/': '/ru/',
  },
});
