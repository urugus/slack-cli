import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('slack-cli version', () => {
  it('should display the correct version from package.json', () => {
    // Read the expected version from package.json
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
    );
    const expectedVersion = packageJson.version;

    // Execute the CLI command to get version using ts-node
    const output = execSync('npx ts-node src/index.ts --version', {
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    }).trim();

    // The output should contain the version from package.json
    expect(output).toBe(expectedVersion);
  });

  it('should display version with -V flag', () => {
    // Read the expected version from package.json
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
    );
    const expectedVersion = packageJson.version;

    // Execute the CLI command with -V flag using ts-node
    const output = execSync('npx ts-node src/index.ts -V', {
      encoding: 'utf-8',
      cwd: join(__dirname, '..')
    }).trim();

    // The output should contain the version from package.json
    expect(output).toBe(expectedVersion);
  });
});