export function formatUnixTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

export function formatSlackTimestamp(slackTimestamp: string): string {
  const timestamp = parseFloat(slackTimestamp);
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatTimestampFixed(slackTimestamp: string): string {
  const timestamp = parseFloat(slackTimestamp);
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
