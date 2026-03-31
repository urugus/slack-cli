/**
 * CI runner script for supply chain security checks.
 * Invoked by the GitHub Actions workflow to analyze dependency changes,
 * fetch package metadata, run npm audit, and output a markdown report.
 *
 * Usage: npx tsx scripts/supply-chain-check-runner.ts <base-package-json>
 *   base-package-json: JSON string of the base branch's package.json
 *
 * Outputs the markdown report to stdout.
 */

import * as fs from 'node:fs';
import {
  analyzePackageRisk,
  type DependencyChange,
  fetchPackageMetadata,
  findDependencyChanges,
  generateReport,
  runNpmAudit,
} from './supply-chain-check';

async function main() {
  const basePackageJsonStr = process.argv[2];
  if (!basePackageJsonStr) {
    console.error('Usage: supply-chain-check-runner.ts <base-package-json>');
    process.exit(1);
  }

  const basePackage = JSON.parse(basePackageJsonStr);
  const headPackage = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  // Find all dependency changes (production + dev)
  const prodChanges = findDependencyChanges(basePackage.dependencies, headPackage.dependencies);
  const devChanges = findDependencyChanges(
    basePackage.devDependencies,
    headPackage.devDependencies
  );
  const allChanges = [...prodChanges, ...devChanges];

  // Analyze risk for added and updated packages
  const packagesToCheck = allChanges.filter(
    (c): c is DependencyChange & { newVersion: string } =>
      (c.type === 'added' || c.type === 'updated') && c.newVersion !== undefined
  );

  const riskResults: { pkg: string; risks: ReturnType<typeof analyzePackageRisk> }[] = [];

  for (const pkg of packagesToCheck) {
    try {
      const metadata = await fetchPackageMetadata(pkg.name, pkg.newVersion);
      const risks = analyzePackageRisk(metadata);
      riskResults.push({ pkg: pkg.name, risks });
    } catch (error) {
      riskResults.push({
        pkg: pkg.name,
        risks: [
          {
            type: 'no-repository' as const,
            severity: 'high' as const,
            message: `Failed to fetch package metadata: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      });
    }
  }

  // Run npm audit
  const auditResult = await runNpmAudit();

  // Generate report
  const report = generateReport(allChanges, riskResults, auditResult);
  console.log(report);
}

main().catch((error) => {
  console.error('Supply chain check failed:', error);
  process.exit(1);
});
