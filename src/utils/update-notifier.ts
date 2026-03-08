import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import semverGt from 'semver/functions/gt';
import { FILE_PERMISSIONS } from './constants';

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REQUEST_TIMEOUT_MS = 2000;

interface UpdateNotifierCache {
  latestVersion: string;
  lastCheckedAt: string;
}

interface CheckForUpdatesOptions {
  packageName: string;
  currentVersion: string;
  cacheDir?: string;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}

export async function checkForUpdates(options: CheckForUpdatesOptions): Promise<void> {
  if (shouldSkipUpdateCheck()) {
    return;
  }

  const cachePath = path.join(
    options.cacheDir || path.join(os.homedir(), '.slack-cli'),
    'update-notifier.json'
  );
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  try {
    const cached = await readCache(cachePath);
    const latestVersion =
      cached && isFresh(cached.lastCheckedAt, cacheTtlMs)
        ? cached.latestVersion
        : await fetchLatestVersion(options.packageName, options.fetchImpl, cachePath);

    if (semverGt(latestVersion, options.currentVersion)) {
      notifyUpdate(options.currentVersion, latestVersion, options.packageName);
    }
  } catch {
    // Update checks must never affect normal CLI behavior.
  }
}

function shouldSkipUpdateCheck(): boolean {
  return (
    process.env.CI !== undefined ||
    process.env.SLACK_CLI_DISABLE_UPDATE_NOTIFIER === '1' ||
    process.stderr.isTTY === false
  );
}

function isFresh(lastCheckedAt: string, cacheTtlMs: number): boolean {
  const lastCheckedTime = Date.parse(lastCheckedAt);
  if (Number.isNaN(lastCheckedTime)) {
    return false;
  }

  return Date.now() - lastCheckedTime < cacheTtlMs;
}

async function fetchLatestVersion(
  packageName: string,
  fetchImpl: typeof fetch = fetch,
  cachePath: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const payload = (await response.json()) as { version?: unknown };
    if (typeof payload.version !== 'string' || payload.version.length === 0) {
      throw new Error('Registry response does not contain a valid version');
    }

    await writeCache(cachePath, {
      latestVersion: payload.version,
      lastCheckedAt: new Date().toISOString(),
    });

    return payload.version;
  } finally {
    clearTimeout(timeout);
  }
}

async function readCache(cachePath: string): Promise<UpdateNotifierCache | null> {
  try {
    const raw = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<UpdateNotifierCache>;

    if (typeof parsed.latestVersion !== 'string' || typeof parsed.lastCheckedAt !== 'string') {
      return null;
    }

    return {
      latestVersion: parsed.latestVersion,
      lastCheckedAt: parsed.lastCheckedAt,
    };
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return null;
    }

    return null;
  }
}

async function writeCache(cachePath: string, cache: UpdateNotifierCache): Promise<void> {
  const cacheDir = path.dirname(cachePath);
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;

  await fs.mkdir(cacheDir, { recursive: true, mode: FILE_PERMISSIONS.CONFIG_DIR });
  await fs.writeFile(tempPath, JSON.stringify(cache, null, 2), {
    encoding: 'utf-8',
    mode: FILE_PERMISSIONS.CONFIG_FILE,
    flag: 'wx',
  });

  try {
    await fs.rename(tempPath, cachePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function notifyUpdate(currentVersion: string, latestVersion: string, packageName: string): void {
  console.error(chalk.yellow(`Update available: ${currentVersion} -> ${latestVersion}`));
  console.error(chalk.yellow(`Run: npm install -g ${packageName}`));
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
