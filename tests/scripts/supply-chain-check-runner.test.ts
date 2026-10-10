import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  runNpmAudit: vi.fn(),
  fetchPackageMetadata: vi.fn(),
}));

vi.mock('node:fs', () => ({ readFileSync: mocks.readFileSync }));
vi.mock('../../scripts/supply-chain-check', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../scripts/supply-chain-check')>()),
  runNpmAudit: mocks.runNpmAudit,
  fetchPackageMetadata: mocks.fetchPackageMetadata,
}));

describe('supply chain check exit status', () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.argv = ['node', 'runner', '/tmp/base-package.json'];
    process.exitCode = 0;
    mocks.readFileSync.mockReturnValue('{}');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it.each(['high', 'critical'])('fails after reporting %s vulnerabilities', async (severity) => {
    mocks.runNpmAudit.mockResolvedValue({ vulnerabilities: { total: 1, [severity]: 1 } });

    await import('../../scripts/supply-chain-check-runner');

    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('1 vulnerabilities'));
  });

  it('reports low and moderate vulnerabilities without blocking', async () => {
    mocks.runNpmAudit.mockResolvedValue({
      vulnerabilities: { total: 2, low: 1, moderate: 1, high: 0, critical: 0 },
    });

    await import('../../scripts/supply-chain-check-runner');

    await vi.waitFor(() => expect(console.log).toHaveBeenCalled());
    expect(process.exitCode).toBe(0);
  });

  it('keeps package popularity and age signals informational', async () => {
    mocks.readFileSync.mockImplementation((path) =>
      JSON.stringify(
        path === 'package.json'
          ? { dependencies: { example: '1.0.0' } }
          : path === 'package-lock.json'
            ? { packages: { 'node_modules/example': { version: '1.0.0' } } }
            : {}
      )
    );
    mocks.fetchPackageMetadata.mockResolvedValue({
      publishedAt: new Date().toISOString(),
      weeklyDownloads: 1,
      maintainerCount: 1,
    });
    mocks.runNpmAudit.mockResolvedValue({ vulnerabilities: { total: 0 } });

    await import('../../scripts/supply-chain-check-runner');

    await vi.waitFor(() => expect(console.log).toHaveBeenCalled());
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('very-new-version'));
    expect(process.exitCode).toBe(0);
  });

  it('fails when the audit cannot complete', async () => {
    mocks.runNpmAudit.mockRejectedValue(new Error('Registry unavailable'));

    await import('../../scripts/supply-chain-check-runner');

    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));
    expect(console.error).toHaveBeenCalledWith('Supply chain check failed:', expect.any(Error));
  });
});
