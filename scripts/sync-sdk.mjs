// Клонирует или обновляет репозитории SDK в .sdk/ для сборки сайта, затем собирает
// справочник API из их исходников (scripts/api-reference.py, griffe через uv).
// Список берётся из src/data/sdks.ts (Node >= 22.18 импортирует .ts напрямую).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sdks, sharedDocs } from '../src/data/sdks.ts';

const root = '.sdk';
mkdirSync(root, { recursive: true });

const repos = new Map([...sdks, ...sharedDocs].map((set) => [set.repo.dir, set.repo.url]));

for (const [dir, url] of repos) {
  const target = join(root, dir);
  if (existsSync(join(target, '.git'))) {
    console.log(`update ${dir}`);
    execFileSync('git', ['-C', target, 'pull', '--ff-only', '--depth', '1'], { stdio: 'inherit' });
  } else {
    console.log(`clone  ${dir}`);
    execFileSync('git', ['clone', '--depth', '1', url, target], { stdio: 'inherit' });
  }
}

// Справочник API: директивы mkdocstrings → .sdk/api/<репозиторий>.json. Без него страницы
// справочника не собираются, поэтому отсутствие uv — ошибка, а не пропуск.
try {
  execFileSync('uv', ['run', '--quiet', 'scripts/api-reference.py'], { stdio: 'inherit' });
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('uv not found: install it (https://docs.astral.sh/uv/) — the API reference is built with griffe.');
    process.exit(1);
  }
  throw error;
}
