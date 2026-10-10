import { execSync, spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('slack-cli version', () => {
  it('should display the correct version from package.json', { timeout: 20000 }, () => {
    // Read the expected version from package.json
    const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    const expectedVersion = packageJson.version;

    // Execute the CLI command to get version using tsx
    const output = execSync('npx --no-install tsx src/index.ts --version', {
      encoding: 'utf-8',
      cwd: join(__dirname, '..'),
    }).trim();

    // The output should contain the version from package.json
    expect(output).toBe(expectedVersion);
  });

  it('should display version with -V flag', { timeout: 20000 }, () => {
    // Read the expected version from package.json
    const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    const expectedVersion = packageJson.version;

    // Execute the CLI command with -V flag using tsx
    const output = execSync('npx --no-install tsx src/index.ts -V', {
      encoding: 'utf-8',
      cwd: join(__dirname, '..'),
    }).trim();

    // The output should contain the version from package.json
    expect(output).toBe(expectedVersion);
  });

  it('starts the development CLI with type checking', { timeout: 30000 }, () => {
    const output = execSync('npm run dev -- --help', {
      encoding: 'utf8',
      cwd: join(__dirname, '..'),
      env: { ...process.env, CI: '1', SLACK_CLI_DISABLE_UPDATE_NOTIFIER: '1' },
    });
    expect(output).toContain('> tsc');
    expect(output).toContain('Usage: slack-cli');
  });

  it('starts the security runner and reports a missing argument without running an audit', () => {
    const result = spawnSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/supply-chain-check-runner.ts'],
      {
        encoding: 'utf8',
        cwd: join(__dirname, '..'),
        timeout: 10000,
      }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: supply-chain-check-runner.ts');
    expect(result.stderr).not.toContain('TypeError');
  });
});
