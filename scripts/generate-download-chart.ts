import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function fetchDownloads(startDate: string, endDate: string): Promise<NpmDownloadPoint[]> {
  const url = `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${encodeURIComponent(PACKAGE_NAME)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch downloads: ${response.statusText}`);
  }
  const data = (await response.json()) as NpmDownloadRange;
  return data.downloads;
}

function aggregateByMonth(points: NpmDownloadPoint[]): MonthlyData[] {
  const monthMap = new Map<string, number>();
  for (const point of points) {
    const month = point.day.slice(0, 7);
    monthMap.set(month, (monthMap.get(month) ?? 0) + point.downloads);
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, downloads]) => ({ month, downloads }));
}

async function generateChart(labels: string[], data: number[]): Promise<Buffer> {
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
          text: `${PACKAGE_NAME} - Monthly Downloads (past 12 months)`,
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart: chartConfig,
      width: 800,
      height: 400,
      format: 'png',
      backgroundColor: 'white',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate chart: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main(): Promise<void> {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().slice(0, 10);

  console.log(`Fetching downloads for ${PACKAGE_NAME} (${startDate} to ${endDate})...`);
  const dailyDownloads = await fetchDownloads(startDate, endDate);

  const monthly = aggregateByMonth(dailyDownloads);
  const labels = monthly.map((d) => d.month);
  const data = monthly.map((d) => d.downloads);

  console.log('Generating chart via quickchart.io...');
  const chartBuffer = await generateChart(labels, data);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const assetsDir = join(__dirname, '..', 'assets');
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(assetsDir, 'downloads.png'), chartBuffer);

  const total = data.reduce((sum, d) => sum + d, 0);
  console.log(`Chart saved to assets/downloads.png (total: ${total.toLocaleString()} downloads)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
