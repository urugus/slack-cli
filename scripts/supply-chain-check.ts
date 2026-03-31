export interface DependencyChange {
  name: string;
  type: 'added' | 'updated' | 'removed';
  oldVersion?: string;
  newVersion?: string;
}

export interface PackageMetadata {
  name: string;
  version: string;
  publishedAt: string;
  maintainerCount: number;
  weeklyDownloads: number;
  hasTypes: boolean;
  license?: string;
  repositoryUrl?: string;
  description?: string;
}

export interface RiskSignal {
  type:
    | 'very-new-version'
    | 'low-downloads'
    | 'single-maintainer'
    | 'no-repository'
    | 'no-license'
    | 'metadata-fetch-failed';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface NpmAuditResult {
  vulnerabilities: {
    total: number;
    critical?: number;
    high?: number;
    moderate?: number;
    low?: number;
  };
  advisories?: {
    severity: string;
    title: string;
    module_name: string;
    url: string;
  }[];
}

const DOWNLOAD_THRESHOLD_LOW = 100;
const NEW_VERSION_DAYS = 7;

export function findDependencyChanges(
  baseDeps: Record<string, string> | undefined,
  headDeps: Record<string, string> | undefined
): DependencyChange[] {
  const base = baseDeps ?? {};
  const head = headDeps ?? {};
  const changes: DependencyChange[] = [];

  for (const [name, version] of Object.entries(head)) {
    if (!(name in base)) {
      changes.push({ name, type: 'added', newVersion: version });
    } else if (base[name] !== version) {
      changes.push({
        name,
        type: 'updated',
        oldVersion: base[name],
        newVersion: version,
      });
    }
  }

  for (const [name, version] of Object.entries(base)) {
    if (!(name in head)) {
      changes.push({ name, type: 'removed', oldVersion: version });
    }
  }

  return changes;
}

export function analyzePackageRisk(metadata: PackageMetadata): RiskSignal[] {
  const risks: RiskSignal[] = [];

  const publishedTime = new Date(metadata.publishedAt).getTime();
  if (!Number.isNaN(publishedTime)) {
    const diffMs = Date.now() - publishedTime;
    if (diffMs >= 0) {
      const daysSincePublish = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysSincePublish <= NEW_VERSION_DAYS) {
        risks.push({
          type: 'very-new-version',
          severity: 'high',
          message: `Package version published ${daysSincePublish} days ago`,
        });
      }
    }
  }

  if (metadata.weeklyDownloads < DOWNLOAD_THRESHOLD_LOW) {
    risks.push({
      type: 'low-downloads',
      severity: 'high',
      message: `Very low weekly downloads (${metadata.weeklyDownloads})`,
    });
  }

  if (metadata.maintainerCount === 1) {
    risks.push({
      type: 'single-maintainer',
      severity: 'medium',
      message: 'Package has only a single maintainer',
    });
  }

  if (!metadata.repositoryUrl) {
    risks.push({
      type: 'no-repository',
      severity: 'medium',
      message: 'No source repository URL found',
    });
  }

  if (!metadata.license) {
    risks.push({
      type: 'no-license',
      severity: 'medium',
      message: 'No license specified',
    });
  }

  return risks;
}

export function generateReport(
  changes: DependencyChange[],
  riskResults: { pkg: string; risks: RiskSignal[] }[],
  auditResult: NpmAuditResult
): string {
  const hasRisks = riskResults.some((r) => r.risks.length > 0);
  const hasVulnerabilities = auditResult.vulnerabilities.total > 0;
  const statusIcon = hasRisks || hasVulnerabilities ? '⚠️' : '✅';

  const lines: string[] = [];
  lines.push(`## ${statusIcon} Supply Chain Security Check`);
  lines.push('');

  // Dependency changes section
  lines.push('### Dependency Changes');
  lines.push('');
  if (changes.length === 0) {
    lines.push('No dependency changes detected in this PR.');
  } else {
    lines.push('| Package | Change | Version |');
    lines.push('|---------|--------|---------|');
    for (const change of changes) {
      const version =
        change.type === 'removed'
          ? `~~${change.oldVersion}~~`
          : change.type === 'updated'
            ? `${change.oldVersion} → ${change.newVersion}`
            : change.newVersion;
      lines.push(`| ${change.name} | ${change.type} | ${version} |`);
    }
  }
  lines.push('');

  // Risk signals section
  if (riskResults.some((r) => r.risks.length > 0)) {
    lines.push('### Risk Signals');
    lines.push('');
    for (const result of riskResults) {
      if (result.risks.length === 0) continue;
      lines.push(`**${result.pkg}:**`);
      for (const risk of result.risks) {
        const icon = risk.severity === 'high' ? '🔴' : '🟡';
        lines.push(`- ${icon} \`${risk.type}\`: ${risk.message}`);
      }
      lines.push('');
    }
  }

  // npm audit section
  lines.push('### npm audit');
  lines.push('');
  if (auditResult.vulnerabilities.total === 0) {
    lines.push('No known vulnerabilities found.');
  } else {
    const v = auditResult.vulnerabilities;
    const parts: string[] = [];
    if (v.critical) parts.push(`**${v.critical} critical**`);
    if (v.high) parts.push(`**${v.high} high**`);
    if (v.moderate) parts.push(`${v.moderate} moderate`);
    if (v.low) parts.push(`${v.low} low`);
    lines.push(`Found ${v.total} vulnerabilities: ${parts.join(', ')}`);
    lines.push('');
    if (auditResult.advisories?.length) {
      lines.push('| Severity | Package | Title | Link |');
      lines.push('|----------|---------|-------|------|');
      for (const advisory of auditResult.advisories) {
        lines.push(
          `| ${advisory.severity} | ${advisory.module_name} | ${advisory.title} | [Details](${advisory.url}) |`
        );
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

export function parseNpmAuditJson(json: string): NpmAuditResult | null {
  try {
    const result = JSON.parse(json);
    const vuln = result.metadata?.vulnerabilities ?? {};
    return {
      vulnerabilities: {
        total: (vuln.critical ?? 0) + (vuln.high ?? 0) + (vuln.moderate ?? 0) + (vuln.low ?? 0),
        critical: vuln.critical,
        high: vuln.high,
        moderate: vuln.moderate,
        low: vuln.low,
      },
      advisories: Object.values(result.advisories ?? {}).map((a: Record<string, unknown>) => ({
        severity: a.severity as string,
        title: a.title as string,
        module_name: a.module_name as string,
        url: a.url as string,
      })),
    };
  } catch {
    return null;
  }
}

export async function fetchPackageMetadata(
  packageName: string,
  version: string
): Promise<PackageMetadata> {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const response = await fetch(registryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${packageName}: ${response.status}`);
  }
  const data = await response.json();

  const versionData = data.versions?.[version] ?? {};
  const timeData = data.time ?? {};

  const downloadsUrl = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`;
  let weeklyDownloads = 0;
  try {
    const dlResponse = await fetch(downloadsUrl);
    if (dlResponse.ok) {
      const dlData = await dlResponse.json();
      weeklyDownloads = dlData.downloads ?? 0;
    }
  } catch {
    // Ignore download count fetch failures
  }

  return {
    name: packageName,
    version,
    publishedAt: timeData[version] ?? timeData.created ?? new Date().toISOString(),
    maintainerCount: (data.maintainers ?? []).length,
    weeklyDownloads,
    hasTypes: !!versionData.types || !!versionData.typings,
    license: versionData.license ?? data.license,
    repositoryUrl: versionData.repository?.url ?? data.repository?.url,
    description: data.description,
  };
}

export async function runNpmAudit(): Promise<NpmAuditResult> {
  const { execSync } = await import('node:child_process');
  try {
    const output = execSync('npm audit --json 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 60000,
    });
    const parsed = parseNpmAuditJson(output);
    if (parsed) {
      return parsed;
    }
  } catch (error: unknown) {
    // npm audit exits with non-zero when vulnerabilities are found
    const err = error as { stdout?: string };
    if (err.stdout) {
      const parsed = parseNpmAuditJson(err.stdout);
      if (parsed) {
        return parsed;
      }
    }
  }
  return { vulnerabilities: { total: 0 } };
}
