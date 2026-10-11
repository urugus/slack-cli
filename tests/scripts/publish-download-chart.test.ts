import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const helper = resolve('scripts/publish-download-chart.sh');
const branch = 'codex/download-statistics';
let root: string;
let repo: string;
let remote: string;
let originalMain: string;

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function publish(content: string): void {
  mkdirSync(join(repo, 'assets'), { recursive: true });
  writeFileSync(join(repo, 'assets', 'downloads.png'), content);
  execFileSync('bash', [helper], { cwd: repo, encoding: 'utf8' });
}

function freshCheckout(): void {
  repo = join(root, `clone-${Date.now()}`);
  execFileSync('git', ['clone', '--branch', 'main', remote, repo], { encoding: 'utf8' });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'slack-cli-chart-test-'));
  repo = join(root, 'source');
  remote = join(root, 'remote.git');
  mkdirSync(repo);
  execFileSync('git', ['init', '--bare', remote]);
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Chart test');
  git('config', 'user.email', 'chart-test@example.invalid');
  writeFileSync(join(repo, 'README.md'), 'original main');
  git('add', 'README.md');
  git('commit', '-m', 'Initial main');
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'main');
  originalMain = git('rev-parse', 'main');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('chart publication', () => {
  it('creates an image-only branch without changing main', () => {
    publish('first PNG');
    expect(git('ls-tree', '-r', '--name-only', branch)).toBe('assets/downloads.png');
    expect(git('show', `${branch}:assets/downloads.png`)).toBe('first PNG');
    expect(git('rev-parse', 'origin/main')).toBe(originalMain);
  });

  it('updates the image branch from a fresh main checkout', () => {
    publish('first PNG');
    freshCheckout();
    publish('updated PNG');
    expect(git('show', `${branch}:assets/downloads.png`)).toBe('updated PNG');
    expect(git('rev-list', '--count', branch)).toBe('2');
    expect(git('rev-parse', 'origin/main')).toBe(originalMain);
  });

  it('does not create another commit for an unchanged image', () => {
    publish('same PNG');
    const firstCommit = git('rev-parse', branch);
    freshCheckout();
    publish('same PNG');
    expect(git('rev-parse', branch)).toBe(firstCommit);
    expect(git('rev-parse', 'origin/main')).toBe(originalMain);
  });

  it('refuses to overwrite unrelated tracked edits', () => {
    writeFileSync(join(repo, 'README.md'), 'uncommitted user edit');
    const result = spawnSync('bash', [helper], { cwd: repo, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tracked changes');
    expect(readFileSync(join(repo, 'README.md'), 'utf8')).toBe('uncommitted user edit');
    expect(git('branch', '--show-current')).toBe('main');
  });
});
