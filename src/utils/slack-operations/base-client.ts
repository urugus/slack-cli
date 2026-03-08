import { LogLevel, WebClient } from '@slack/web-api';
import pLimit from 'p-limit';
import { RATE_LIMIT } from '../constants';

export interface SharedSlackClientContext {
  client: WebClient;
  rateLimiter: ReturnType<typeof pLimit>;
}

export type SlackClientDependency = string | WebClient | SharedSlackClientContext;

export function createSlackClientContext(token: string): SharedSlackClientContext {
  return {
    client: new WebClient(token, {
      retryConfig: {
        retries: 0, // Disable automatic retries to handle rate limits manually
      },
      logLevel: LogLevel.ERROR, // Reduce noise from WebClient logs
    }),
    rateLimiter: pLimit(RATE_LIMIT.CONCURRENT_REQUESTS),
  };
}

export class BaseSlackClient {
  protected client: WebClient;
  protected rateLimiter: ReturnType<typeof pLimit>;

  constructor(dependency: SlackClientDependency) {
    if (typeof dependency === 'string') {
      const context = createSlackClientContext(dependency);
      this.client = context.client;
      this.rateLimiter = context.rateLimiter;
      return;
    }

    if ('client' in dependency && 'rateLimiter' in dependency) {
      this.client = dependency.client;
      this.rateLimiter = dependency.rateLimiter;
      return;
    }

    this.client = dependency;
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
