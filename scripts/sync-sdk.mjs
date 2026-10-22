// Клонирует или обновляет репозитории SDK в .sdk/ для сборки сайта.
// Список берётся из src/data/sdks.ts (Node >= 22.18 импортирует .ts напрямую).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { sdks } from '../src/data/sdks.ts';

const root = '.sdk';
mkdirSync(root, { recursive: true });

const repos = new Map(sdks.map((sdk) => [sdk.repo.dir, sdk.repo.url]));

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
