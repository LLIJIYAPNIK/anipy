// Последняя версия SDK (#70): с PyPI при сборке, без сети — из CHANGELOG.md репозитория.
// Сайт пересобирается по repository_dispatch: sdk-release, так что версия обновляется сама.
import { existsSync, readFileSync } from 'node:fs';
import { sdkDir, type Sdk } from '../data/sdks';
import { parseChangelog } from './changelog';

export type Version = {
  version: string;
  /** Дата релиза, YYYY-MM-DD. */
  date: string;
  source: 'pypi' | 'changelog';
};

const fromPypi = async (pkg: string): Promise<Version | undefined> => {
  const response = await fetch(`https://pypi.org/pypi/${pkg}/json`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return undefined;
  const data = (await response.json()) as {
    info: { version: string };
    releases: Record<string, { upload_time_iso_8601: string }[]>;
  };
  const version = data.info.version;
  const date = data.releases[version]?.[0]?.upload_time_iso_8601.slice(0, 10);
  return date ? { version, date, source: 'pypi' } : undefined;
};

const fromChangelog = (sdk: Sdk): Version | undefined => {
  const file = `${sdkDir(sdk)}/CHANGELOG.md`;
  const latest = existsSync(file) ? parseChangelog(readFileSync(file, 'utf8'))[0] : undefined;
  return latest && { version: latest.version, date: latest.date, source: 'changelog' };
};

const cache = new Map<Sdk, Promise<Version | undefined>>();

/** Версия и дата последнего релиза; один запрос к PyPI на SDK за сборку. */
export const latestVersion = (sdk: Sdk) => {
  let pending = cache.get(sdk);
  if (!pending) {
    pending = fromPypi(sdk.package)
      .catch(() => undefined)
      .then((version) => {
        if (version) return version;
        console.warn(`[versions] ${sdk.package}: PyPI unavailable, using CHANGELOG.md`);
        return fromChangelog(sdk);
      });
    cache.set(sdk, pending);
  }
  return pending;
};
