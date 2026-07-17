#!/usr/bin/env node

const fs = require('node:fs');

const SAFE_UPDATE_TYPES = new Set(['version-update:semver-patch', 'version-update:semver-minor']);

const SUPPORTED_ECOSYSTEMS = new Set(['npm', 'npm_and_yarn', 'github_actions']);

const PACKAGE_VERSION_FILES = new Set(['package.json', 'package-lock.json']);

function normalizeEcosystem(ecosystem) {
  return String(ecosystem || '').replaceAll('-', '_');
}

function normalizeMetadata(metadata = {}) {
  return {
    dependencyNames: metadata.dependencyNames || metadata['dependency-names'] || '',
    dependencyType: metadata.dependencyType || metadata['dependency-type'] || '',
    ecosystem: normalizeEcosystem(
      metadata.ecosystem || metadata.packageEcosystem || metadata['package-ecosystem']
    ),
    maintainerChanges: String(
      metadata.maintainerChanges || metadata['maintainer-changes'] || 'false'
    ),
    updateType: metadata.updateType || metadata['update-type'] || '',
  };
}

function isTruthy(value) {
  return ['1', 'true', 'yes'].includes(String(value).toLowerCase());
}

function isAllowedNpmFile(file) {
  return PACKAGE_VERSION_FILES.has(file);
}

function isAllowedGitHubActionsFile(file) {
  return (
    file.startsWith('.github/workflows/') ||
    file.startsWith('.github/actions/') ||
    file === 'action.yml' ||
    file === 'action.yaml' ||
    PACKAGE_VERSION_FILES.has(file)
  );
}

function findUnexpectedFiles(ecosystem, changedFiles) {
  const isAllowedFile =
    ecosystem === 'github_actions' ? isAllowedGitHubActionsFile : isAllowedNpmFile;
  return changedFiles.filter((file) => !isAllowedFile(file));
}

function evaluateDependabotRisk(input) {
  const metadata = normalizeMetadata(input.metadata);
  const changedFiles = [...new Set(input.changedFiles || [])].filter(Boolean).sort();

  if (!metadata.dependencyNames || !metadata.ecosystem || !metadata.updateType) {
    return {
      status: 'unsafe',
      reason: 'Dependabot metadata is incomplete.',
    };
  }

  if (!SUPPORTED_ECOSYSTEMS.has(metadata.ecosystem)) {
    return {
      status: 'unsafe',
      reason: `Unsupported ecosystem: ${metadata.ecosystem}.`,
    };
  }

  if (isTruthy(metadata.maintainerChanges)) {
    return {
      status: 'unsafe',
      reason: 'PR contains maintainer changes.',
    };
  }

  if (!SAFE_UPDATE_TYPES.has(metadata.updateType)) {
    return {
      status: 'unsafe',
      reason: `Update type is not allowed for auto release: ${metadata.updateType}. Major and unknown updates require human review.`,
    };
  }

  if (changedFiles.length === 0) {
    return {
      status: 'unsafe',
      reason: 'No changed files were provided for risk evaluation.',
    };
  }

  const unexpectedFiles = findUnexpectedFiles(metadata.ecosystem, changedFiles);
  if (unexpectedFiles.length > 0) {
    return {
      status: 'unsafe',
      reason: `Unexpected files changed: ${unexpectedFiles.join(', ')}.`,
    };
  }

  return {
    status: 'safe',
    reason: `${metadata.updateType} ${metadata.ecosystem} update for ${metadata.dependencyNames}.`,
  };
}

function parseChangedFiles(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall back to newline or comma separated input.
  }

  return value
    .split(/\r?\n|,/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function appendGithubOutput(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `status=${result.status}\n`);
  fs.appendFileSync(outputPath, `reason=${result.reason}\n`);
}

function runCli() {
  const result = evaluateDependabotRisk({
    changedFiles: parseChangedFiles(process.env.CHANGED_FILES),
    metadata: {
      dependencyNames: process.env.DEPENDENCY_NAMES,
      dependencyType: process.env.DEPENDENCY_TYPE,
      ecosystem: process.env.PACKAGE_ECOSYSTEM,
      maintainerChanges: process.env.MAINTAINER_CHANGES,
      updateType: process.env.UPDATE_TYPE,
    },
  });

  appendGithubOutput(result);
  console.log(`${result.status}: ${result.reason}`);

  if (result.status !== 'safe') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  evaluateDependabotRisk,
  normalizeMetadata,
  parseChangedFiles,
  runCli,
};
