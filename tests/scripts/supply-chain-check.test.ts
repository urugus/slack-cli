import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  analyzePackageRisk,
  type DependencyChange,
  fetchPackageMetadata,
  findDependencyChanges,
  generateReport,
  type NpmAuditResult,
  type PackageMetadata,
  parseNpmAuditJson,
  type RiskSignal,
} from '../../scripts/supply-chain-check';

describe('supply-chain-check', () => {
  describe('findDependencyChanges', () => {
    it('detects newly added dependencies', () => {
      const baseDeps = { chalk: '5.6.2' };
      const headDeps = { chalk: '5.6.2', lodash: '4.17.21' };
      const changes = findDependencyChanges(baseDeps, headDeps);

      expect(changes).toEqual([{ name: 'lodash', type: 'added', newVersion: '4.17.21' }]);
    });

    it('detects updated dependencies', () => {
      const baseDeps = { chalk: '5.6.2' };
      const headDeps = { chalk: '5.7.0' };
      const changes = findDependencyChanges(baseDeps, headDeps);

      expect(changes).toEqual([
        {
          name: 'chalk',
          type: 'updated',
          oldVersion: '5.6.2',
          newVersion: '5.7.0',
        },
      ]);
    });

    it('detects removed dependencies', () => {
      const baseDeps = { chalk: '5.6.2', lodash: '4.17.21' };
      const headDeps = { chalk: '5.6.2' };
      const changes = findDependencyChanges(baseDeps, headDeps);

      expect(changes).toEqual([{ name: 'lodash', type: 'removed', oldVersion: '4.17.21' }]);
    });

    it('handles empty base dependencies', () => {
      const baseDeps = {};
      const headDeps = { chalk: '5.6.2' };
      const changes = findDependencyChanges(baseDeps, headDeps);

      expect(changes).toEqual([{ name: 'chalk', type: 'added', newVersion: '5.6.2' }]);
    });

    it('handles undefined dependencies', () => {
      const changes = findDependencyChanges(undefined, undefined);
      expect(changes).toEqual([]);
    });

    it('returns empty array when no changes', () => {
      const deps = { chalk: '5.6.2' };
      const changes = findDependencyChanges(deps, deps);
      expect(changes).toEqual([]);
    });
  });

  describe('analyzePackageRisk', () => {
    const baseMetadata: PackageMetadata = {
      name: 'chalk',
      version: '5.6.2',
      publishedAt: '2023-01-15T00:00:00.000Z',
      maintainerCount: 3,
      weeklyDownloads: 50_000_000,
      hasTypes: true,
      license: 'MIT',
      repositoryUrl: 'https://github.com/chalk/chalk',
      description: 'Terminal string styling done right',
    };

    it('returns no risks for well-established packages', () => {
      const risks = analyzePackageRisk(baseMetadata);
      expect(risks).toEqual([]);
    });

    it('flags packages published within last 7 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const metadata: PackageMetadata = {
        ...baseMetadata,
        publishedAt: recentDate.toISOString(),
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).toContainEqual(expect.objectContaining({ type: 'very-new-version' }));
    });

    it('flags packages with very low download counts', () => {
      const metadata: PackageMetadata = {
        ...baseMetadata,
        weeklyDownloads: 50,
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).toContainEqual(expect.objectContaining({ type: 'low-downloads' }));
    });

    it('flags packages with single maintainer', () => {
      const metadata: PackageMetadata = {
        ...baseMetadata,
        maintainerCount: 1,
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).toContainEqual(expect.objectContaining({ type: 'single-maintainer' }));
    });

    it('flags packages without repository URL', () => {
      const metadata: PackageMetadata = {
        ...baseMetadata,
        repositoryUrl: undefined,
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).toContainEqual(expect.objectContaining({ type: 'no-repository' }));
    });

    it('flags packages without license', () => {
      const metadata: PackageMetadata = {
        ...baseMetadata,
        license: undefined,
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).toContainEqual(expect.objectContaining({ type: 'no-license' }));
    });

    it('does not flag very-new-version for invalid publishedAt', () => {
      const metadata: PackageMetadata = {
        ...baseMetadata,
        publishedAt: 'invalid-date',
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).not.toContainEqual(expect.objectContaining({ type: 'very-new-version' }));
    });

    it('does not flag very-new-version for future publishedAt', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const metadata: PackageMetadata = {
        ...baseMetadata,
        publishedAt: futureDate.toISOString(),
      };

      const risks = analyzePackageRisk(metadata);
      expect(risks).not.toContainEqual(expect.objectContaining({ type: 'very-new-version' }));
    });
  });

  describe('generateReport', () => {
    it('generates report with no issues found', () => {
      const report = generateReport([], [], {
        vulnerabilities: { total: 0 },
      });

      expect(report).toContain('Supply Chain Security Check');
      expect(report).toContain('No dependency changes detected');
      expect(report).toContain('No known vulnerabilities found');
    });

    it('generates report with added dependencies and no risks', () => {
      const changes: DependencyChange[] = [{ name: 'chalk', type: 'added', newVersion: '5.6.2' }];
      const riskResults: { pkg: string; risks: RiskSignal[] }[] = [{ pkg: 'chalk', risks: [] }];

      const report = generateReport(changes, riskResults, {
        vulnerabilities: { total: 0 },
      });

      expect(report).toContain('chalk');
      expect(report).toContain('added');
      expect(report).toContain('5.6.2');
    });

    it('generates report with vulnerabilities', () => {
      const auditResult: NpmAuditResult = {
        vulnerabilities: {
          total: 2,
          critical: 1,
          high: 1,
        },
        advisories: [
          {
            severity: 'critical',
            title: 'Prototype Pollution',
            module_name: 'lodash',
            url: 'https://npmjs.com/advisories/1234',
          },
        ],
      };

      const report = generateReport([], [], auditResult);

      expect(report).toContain('2 vulnerabilities');
      expect(report).toContain('critical');
      expect(report).toContain('Prototype Pollution');
    });

    it('generates report with risk signals', () => {
      const changes: DependencyChange[] = [
        { name: 'suspicious-pkg', type: 'added', newVersion: '0.0.1' },
      ];
      const riskResults: { pkg: string; risks: RiskSignal[] }[] = [
        {
          pkg: 'suspicious-pkg',
          risks: [
            {
              type: 'very-new-version',
              severity: 'high',
              message: 'Package version published 2 days ago',
            },
            {
              type: 'low-downloads',
              severity: 'high',
              message: 'Very low weekly downloads (10)',
            },
          ],
        },
      ];

      const report = generateReport(changes, riskResults, {
        vulnerabilities: { total: 0 },
      });

      expect(report).toContain('suspicious-pkg');
      expect(report).toContain('Risk Signals');
      expect(report).toContain('very-new-version');
      expect(report).toContain('low-downloads');
    });

    it('includes summary status with warning when risks found', () => {
      const riskResults: { pkg: string; risks: RiskSignal[] }[] = [
        {
          pkg: 'risky-pkg',
          risks: [
            {
              type: 'low-downloads',
              severity: 'high',
              message: 'Very low weekly downloads (5)',
            },
          ],
        },
      ];

      const report = generateReport(
        [{ name: 'risky-pkg', type: 'added', newVersion: '1.0.0' }],
        riskResults,
        { vulnerabilities: { total: 0 } }
      );

      expect(report).toContain('⚠️');
    });

    it('includes summary status with check when all clear', () => {
      const report = generateReport([], [], {
        vulnerabilities: { total: 0 },
      });

      expect(report).toContain('✅');
    });

    it('generates report with metadata-fetch-failed risk signal', () => {
      const changes: DependencyChange[] = [
        { name: 'unknown-pkg', type: 'added', newVersion: '1.0.0' },
      ];
      const riskResults: { pkg: string; risks: RiskSignal[] }[] = [
        {
          pkg: 'unknown-pkg',
          risks: [
            {
              type: 'metadata-fetch-failed',
              severity: 'high',
              message: 'Failed to fetch package metadata: 404',
            },
          ],
        },
      ];

      const report = generateReport(changes, riskResults, {
        vulnerabilities: { total: 0 },
      });

      expect(report).toContain('metadata-fetch-failed');
      expect(report).toContain('⚠️');
    });
  });

  describe('parseNpmAuditJson', () => {
    it('parses valid npm audit JSON with vulnerabilities', () => {
      const json = JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 1, high: 2, moderate: 0, low: 1 },
        },
        advisories: {
          '1234': {
            severity: 'critical',
            title: 'RCE in foo',
            module_name: 'foo',
            url: 'https://npmjs.com/advisories/1234',
          },
        },
      });

      const result = parseNpmAuditJson(json);
      expect(result).not.toBeNull();
      expect(result?.vulnerabilities.total).toBe(4);
      expect(result?.vulnerabilities.critical).toBe(1);
      expect(result?.vulnerabilities.high).toBe(2);
      expect(result?.advisories).toHaveLength(1);
      expect(result?.advisories?.[0].title).toBe('RCE in foo');
    });

    it('parses valid npm audit JSON with no vulnerabilities', () => {
      const json = JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
        },
        advisories: {},
      });

      const result = parseNpmAuditJson(json);
      expect(result).not.toBeNull();
      expect(result?.vulnerabilities.total).toBe(0);
    });

    it('returns null for invalid JSON', () => {
      const result = parseNpmAuditJson('not valid json');
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = parseNpmAuditJson('');
      expect(result).toBeNull();
    });

    it('handles missing metadata gracefully', () => {
      const json = JSON.stringify({});
      const result = parseNpmAuditJson(json);
      expect(result).not.toBeNull();
      expect(result?.vulnerabilities.total).toBe(0);
    });
  });

  describe('fetchPackageMetadata', () => {
    let fetchSpy: MockInstance;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches and parses registry data correctly', async () => {
      const registryResponse = {
        name: 'chalk',
        description: 'Terminal string styling',
        maintainers: [{ name: 'sindresorhus' }, { name: 'qix' }],
        license: 'MIT',
        repository: { url: 'https://github.com/chalk/chalk' },
        time: { '5.6.2': '2023-06-01T00:00:00.000Z' },
        versions: {
          '5.6.2': {
            license: 'MIT',
            repository: { url: 'https://github.com/chalk/chalk' },
            types: './index.d.ts',
          },
        },
      };

      const downloadsResponse = { downloads: 50000000 };

      fetchSpy.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('api.npmjs.org/downloads')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(downloadsResponse),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(registryResponse),
        } as Response);
      });

      const metadata = await fetchPackageMetadata('chalk', '5.6.2');

      expect(metadata.name).toBe('chalk');
      expect(metadata.version).toBe('5.6.2');
      expect(metadata.maintainerCount).toBe(2);
      expect(metadata.weeklyDownloads).toBe(50000000);
      expect(metadata.hasTypes).toBe(true);
      expect(metadata.license).toBe('MIT');
      expect(metadata.repositoryUrl).toBe('https://github.com/chalk/chalk');
      expect(metadata.publishedAt).toBe('2023-06-01T00:00:00.000Z');
    });

    it('throws error for non-OK registry response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(fetchPackageMetadata('nonexistent-pkg', '1.0.0')).rejects.toThrow(
        'Failed to fetch metadata for nonexistent-pkg: 404'
      );
    });

    it('handles download API failure gracefully', async () => {
      const registryResponse = {
        name: 'test-pkg',
        maintainers: [{ name: 'user1' }],
        time: { '1.0.0': '2023-01-01T00:00:00.000Z' },
        versions: { '1.0.0': {} },
      };

      fetchSpy.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('api.npmjs.org/downloads')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(registryResponse),
        } as Response);
      });

      const metadata = await fetchPackageMetadata('test-pkg', '1.0.0');
      expect(metadata.weeklyDownloads).toBe(0);
    });

    it('handles missing version in registry data', async () => {
      const registryResponse = {
        name: 'test-pkg',
        maintainers: [],
        time: { created: '2022-01-01T00:00:00.000Z' },
        versions: {},
      };

      fetchSpy.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('api.npmjs.org/downloads')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ downloads: 100 }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(registryResponse),
        } as Response);
      });

      const metadata = await fetchPackageMetadata('test-pkg', '99.0.0');
      expect(metadata.publishedAt).toBe('2022-01-01T00:00:00.000Z');
      expect(metadata.hasTypes).toBe(false);
    });
  });
});
