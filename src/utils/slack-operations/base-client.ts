import { WebClient, LogLevel } from '@slack/web-api';
import pLimit from 'p-limit';
import { RATE_LIMIT } from '../constants';

export class BaseSlackClient {
  protected client: WebClient;
  protected rateLimiter: ReturnType<typeof pLimit>;

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: {
        retries: 0, // Disable automatic retries to handle rate limits manually
      },
      logLevel: LogLevel.ERROR, // Reduce noise from WebClient logs
    });
    // Limit concurrent API calls to avoid rate limiting
    this.rateLimiter = pLimit(RATE_LIMIT.CONCURRENT_REQUESTS);
  }

  protected async handleRateLimit(error: unknown): Promise<void> {
    if (error instanceof Error && error.message?.includes('rate limit')) {
      // If we hit rate limit, wait longer
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  protected async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
