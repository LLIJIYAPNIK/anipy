import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { sdks, sdkDir } from './data/sdks';

// Документы SDK из клонов в .sdk/ (npm run sync). id записи —
// путь относительно .sdk/, например libsocial-sdk/packages/mangalib/readme.
const docFiles = sdks.flatMap((sdk) => {
  const dir = sdkDir(sdk).replace(/^\.sdk\/?/, '');
  return [`${dir}/README.md`, `${dir}/CHANGELOG.md`].map((p) => p.replace(/^\//, ''));
});

const sdkDocs = defineCollection({
  loader: glob({ pattern: docFiles, base: './.sdk' }),
  // README и CHANGELOG обычно без frontmatter; поля добавлять сюда,
  // когда SDK начнут их публиковать, — тогда схема поймает пропажу.
  schema: z.object({}).passthrough(),
});

export const collections = { sdkDocs };
