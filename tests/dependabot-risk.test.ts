import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { evaluateDependabotRisk, normalizeMetadata, parseChangedFiles, runCli } =
  require('../scripts/dependabot-risk.cjs') as typeof import('../scripts/dependabot-risk.cjs');

const safeMetadata = {
  dependencyNames: '@slack/web-api',
  dependencyType: 'direct:production',
  ecosystem: 'npm',
  maintainerChanges: 'false',
  updateType: 'version-update:semver-patch',
};

describe('dependabot risk evaluator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CHANGED_FILES;
    delete process.env.DEPENDENCY_NAMES;
    delete process.env.DEPENDENCY_TYPE;
    delete process.env.PACKAGE_ECOSYSTEM;
    delete process.env.MAINTAINER_CHANGES;
    delete process.env.UPDATE_TYPE;
    delete process.env.GITHUB_OUTPUT;
    process.exitCode = undefined;
  });

  it('marks npm patch updates as safe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['package.json', 'package-lock.json'],
      metadata: safeMetadata,
    });

    expect(result.status).toBe('safe');
  });

  it('marks GitHub Actions minor updates as safe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['.github/workflows/ci.yml'],
      metadata: {
        ...safeMetadata,
        dependencyNames: 'actions/checkout',
        ecosystem: 'github_actions',
        updateType: 'version-update:semver-minor',
      },
    });

    expect(result.status).toBe('safe');
  });

  it('marks major updates as unsafe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['package.json', 'package-lock.json'],
      metadata: {
        ...safeMetadata,
        updateType: 'version-update:semver-major',
      },
    });

    expect(result).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('major'),
    });
  });

  it('marks missing metadata as unsafe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['package.json', 'package-lock.json'],
      metadata: {
        ...safeMetadata,
        updateType: '',
      },
    });

    expect(result).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('metadata'),
    });
  });

  it('marks maintainer changes as unsafe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['package.json', 'package-lock.json'],
      metadata: {
        ...safeMetadata,
        maintainerChanges: 'true',
      },
    });

    expect(result).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('maintainer'),
    });
  });

  it('marks unexpected file changes as unsafe', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['package.json', 'package-lock.json', 'src/index.ts'],
      metadata: safeMetadata,
    });

    expect(result).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('Unexpected files'),
    });
  });

  it('allows package version files after workflow version bump', () => {
    const result = evaluateDependabotRisk({
      changedFiles: ['.github/workflows/ci.yml', 'package.json', 'package-lock.json'],
      metadata: {
        ...safeMetadata,
        dependencyNames: 'actions/setup-node',
        ecosystem: 'github_actions',
      },
    });

    expect(result.status).toBe('safe');
  });

  it('normalizes GitHub metadata keys and ecosystems', () => {
    expect(
      normalizeMetadata({
        'dependency-names': 'vitest',
        'dependency-type': 'direct:development',
        'package-ecosystem': 'npm-and-yarn',
        'maintainer-changes': true,
        'update-type': 'version-update:semver-minor',
      })
    ).toEqual({
      dependencyNames: 'vitest',
      dependencyType: 'direct:development',
      ecosystem: 'npm_and_yarn',
      maintainerChanges: 'true',
      updateType: 'version-update:semver-minor',
    });
  });

  it('parses changed files from JSON, newline, comma, and empty input', () => {
    expect(parseChangedFiles('["package.json","package-lock.json"]')).toEqual([
      'package.json',
      'package-lock.json',
    ]);
    expect(parseChangedFiles('package.json\npackage-lock.json, README.md')).toEqual([
      'package.json',
      'package-lock.json',
      'README.md',
    ]);
    expect(parseChangedFiles('')).toEqual([]);
  });

  it('marks unsupported ecosystems and missing changed files as unsafe', () => {
    expect(
      evaluateDependabotRisk({
        changedFiles: ['Cargo.toml'],
        metadata: { ...safeMetadata, ecosystem: 'cargo' },
      })
    ).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('Unsupported ecosystem'),
    });

    expect(
      evaluateDependabotRisk({
        changedFiles: [],
        metadata: safeMetadata,
      })
    ).toMatchObject({
      status: 'unsafe',
      reason: expect.stringContaining('No changed files'),
    });
  });

  it('runs as a CLI, writes GitHub outputs, and keeps safe updates successful', () => {
    const outputPath = path.join(os.tmpdir(), `dependabot-risk-${process.pid}.txt`);
    fs.rmSync(outputPath, { force: true });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.env.CHANGED_FILES = '["package.json","package-lock.json"]';
    process.env.DEPENDENCY_NAMES = '@slack/web-api';
    process.env.DEPENDENCY_TYPE = 'direct:production';
    process.env.PACKAGE_ECOSYSTEM = 'npm';
    process.env.MAINTAINER_CHANGES = 'false';
    process.env.UPDATE_TYPE = 'version-update:semver-patch';
    process.env.GITHUB_OUTPUT = outputPath;

    runCli();

    expect(process.exitCode).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('safe:'));
    expect(fs.readFileSync(outputPath, 'utf8')).toContain('status=safe\n');
    fs.rmSync(outputPath, { force: true });
  });

  it('runs as a CLI and sets a failing exit code for unsafe updates', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    process.env.CHANGED_FILES = 'package.json';
    process.env.DEPENDENCY_NAMES = '@slack/web-api';
    process.env.PACKAGE_ECOSYSTEM = 'npm';
    process.env.MAINTAINER_CHANGES = 'yes';
    process.env.UPDATE_TYPE = 'version-update:semver-patch';

    runCli();

    expect(process.exitCode).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unsafe:'));
  });
});
