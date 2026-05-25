import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { evaluateDependabotRisk } =
  require('../scripts/dependabot-risk.cjs') as typeof import('../scripts/dependabot-risk.cjs');

const safeMetadata = {
  dependencyNames: '@slack/web-api',
  dependencyType: 'direct:production',
  ecosystem: 'npm',
  maintainerChanges: 'false',
  updateType: 'version-update:semver-patch',
};

describe('dependabot risk evaluator', () => {
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
});
