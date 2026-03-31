import { describe, expect, it } from 'vitest';
import {
  analyzePackageRisk,
  type DependencyChange,
  findDependencyChanges,
  generateReport,
  type NpmAuditResult,
  type PackageMetadata,
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
  });
});
