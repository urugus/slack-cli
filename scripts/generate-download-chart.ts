import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_NAME = '@urugus/slack-cli';
const QUICKCHART_URL = 'https://quickchart.io/chart';

interface NpmDownloadPoint {
  downloads: number;
  day: string;
}

interface NpmDownloadRange {
  downloads: NpmDownloadPoint[];
  package: string;
  start: string;
  end: string;
}

interface MonthlyData {
  month: string;
  downloads: number;
}

export async function fetchDownloads(
  startDate: string,
  endDate: string
): Promise<NpmDownloadPoint[]> {
  const url = `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${encodeURIComponent(PACKAGE_NAME)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch downloads: HTTP ${response.status} ${response.statusText} (${url})`
    );
  }
  const data = (await response.json()) as NpmDownloadRange;
  if (
    !Array.isArray(data?.downloads) ||
    !data.downloads.every(
      (point) =>
        point !== null &&
        typeof point === 'object' &&
        typeof point.day === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(point.day) &&
        Number.isSafeInteger(point.downloads) &&
        point.downloads >= 0
    )
  ) {
    throw new Error('Invalid npm download response');
  }
  return data.downloads;
}

export function aggregateByMonth(points: NpmDownloadPoint[]): MonthlyData[] {
  const monthMap = new Map<string, number>();
  for (const point of points) {
    const month = point.day.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + point.downloads);
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, downloads]) => ({ month, downloads }));
}

export async function generateChart(labels: string[], data: number[]): Promise<Buffer> {
  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Downloads',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `${PACKAGE_NAME} - Monthly Downloads (last 12 complete months)`,
        },
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  };

  const response = await fetch(QUICKCHART_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '4',
      chart: chartConfig,
      width: 800,
      height: 400,
      format: 'png',
      backgroundColor: 'white',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to generate chart: HTTP ${response.status} ${response.statusText} (${QUICKCHART_URL})`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const png = Buffer.from(arrayBuffer);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    !response.headers.get('content-type')?.startsWith('image/png') ||
    !png.subarray(0, 8).equals(signature)
  ) {
    throw new Error('Chart service did not return a PNG image');
  }
  return png;
}

export function getDownloadRange(now: Date): readonly [string, string] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year - 1, month, 1));
  const end = new Date(Date.UTC(year, month, 1) - 86400000);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

export async function main(): Promise<void> {
  const [startDate, endDate] = getDownloadRange(new Date());

  console.log(`Fetching downloads for ${PACKAGE_NAME} (${startDate} to ${endDate})...`);
  const dailyDownloads = await fetchDownloads(startDate, endDate);

  const monthly = aggregateByMonth(dailyDownloads);
  const labels = monthly.map((d) => d.month);
  const data = monthly.map((d) => d.downloads);

  console.log('Generating chart via quickchart.io...');
  const chartBuffer = await generateChart(labels, data);

  const assetsDir = join(process.cwd(), 'assets');
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(assetsDir, 'downloads.png'), chartBuffer);

  const total = data.reduce((sum, d) => sum + d, 0);
  console.log(`Chart saved to assets/downloads.png (total: ${total.toLocaleString()} downloads)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
