import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), mkdirSync: vi.fn(), writeFileSync: vi.fn() }));
vi.mock('node:fs', () => ({ mkdirSync: mocks.mkdirSync, writeFileSync: mocks.writeFileSync }));
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue(new Response('', { status: 503 }));
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('download chart', () => {
  it('does not perform network requests or writes when imported', async () => {
    await import('../../scripts/generate-download-chart');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.writeFileSync).not.toHaveBeenCalled();
  });

  it.each([
    ['2026-10-10T12:00:00Z', '2025-10-01', '2026-09-30'],
    ['2026-01-01T00:00:00Z', '2025-01-01', '2025-12-31'],
    ['2024-03-01T00:00:00Z', '2023-03-01', '2024-02-29'],
    ['2026-01-31T23:30:00-05:00', '2025-02-01', '2026-01-31'],
  ])('selects twelve completed UTC months for %s', async (now, start, end) => {
    const chart = await import('../../scripts/generate-download-chart');
    expect(chart.getDownloadRange(new Date(now))).toEqual([start, end]);
  });

  it('sums daily downloads and sorts calendar months', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    expect(
      chart.aggregateByMonth([
        { day: '2026-08-01', downloads: 4 },
        { day: '2026-07-02', downloads: 2 },
        { day: '2026-07-01', downloads: 1 },
      ])
    ).toEqual([
      { month: '2026-07', downloads: 3 },
      { month: '2026-08', downloads: 4 },
    ]);
  });

  it('requests the scoped package and preserves daily download data', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    const points = [{ day: '2026-09-01', downloads: 7 }];
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ downloads: points })));
    expect(await chart.fetchDownloads('2025-10-01', '2026-09-30')).toEqual(points);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/range/2025-10-01:2026-09-30/%40urugus%2Fslack-cli',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('reports npm HTTP status and URL even without a status message', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    mocks.fetch.mockResolvedValue(new Response('', { status: 403 }));
    await expect(chart.fetchDownloads('2025-10-01', '2026-09-30')).rejects.toThrow(
      /HTTP 403.*api\.npmjs\.org/
    );
  });

  it('reports chart HTTP status and URL even without a status message', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    mocks.fetch.mockResolvedValue(new Response('', { status: 503 }));
    await expect(chart.generateChart(['2026-09'], [7])).rejects.toThrow(/HTTP 503.*quickchart\.io/);
  });

  it('rejects an invalid npm response instead of publishing an incorrect chart', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ downloads: 'invalid' })));
    await expect(chart.fetchDownloads('2025-10-01', '2026-09-30')).rejects.toThrow(
      /Invalid npm download response/
    );
  });

  it('sends a PNG chart request with bounded network waiting', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    mocks.fetch.mockResolvedValue(new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    expect(await chart.generateChart(['2026-09'], [7])).toEqual(png);
    const [url, init] = mocks.fetch.mock.calls.at(-1)!;
    expect(url).toBe('https://quickchart.io/chart');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const request = JSON.parse(init.body);
    expect(request.format).toBe('png');
    expect(request.chart.data.labels).toEqual(['2026-09']);
    expect(request.chart.data.datasets[0].data).toEqual([7]);
  });

  it('rejects non-PNG bytes despite a successful HTTP response', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    mocks.fetch.mockResolvedValue(
      new Response('<html>error</html>', { headers: { 'Content-Type': 'image/png' } })
    );
    await expect(chart.generateChart(['2026-09'], [7])).rejects.toThrow(/PNG/);
  });

  it('writes only the generated PNG for the completed twelve month period', async () => {
    const chart = await import('../../scripts/generate-download-chart');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ downloads: [{ day: '2026-09-01', downloads: 7 }] }))
      )
      .mockResolvedValueOnce(new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    await chart.main();
    expect(mocks.writeFileSync).toHaveBeenCalledExactlyOnceWith(
      join(process.cwd(), 'assets', 'downloads.png'),
      png
    );
    expect(mocks.fetch.mock.calls[0][0]).toContain('2025-10-01:2026-09-30');
  });
});
