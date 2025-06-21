export function formatUnixTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

export function formatSlackTimestamp(slackTimestamp: string): string {
  const timestamp = parseFloat(slackTimestamp);
  return new Date(timestamp * 1000).toLocaleString();
}
