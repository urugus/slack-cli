import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

describe('package supply-chain metadata', () => {
  it('links published package metadata back to the source repository', () => {
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/urugus/slack-cli.git',
    });
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/urugus/slack-cli/issues',
    });
    expect(packageJson.homepage).toBe('https://github.com/urugus/slack-cli#readme');
  });

  it('publishes npm releases with provenance from GitHub Actions', () => {
    expect(releaseWorkflow).toMatch(/id-token:\s*write/);
    expect(releaseWorkflow).toMatch(/npm publish --provenance/);
  });
});
