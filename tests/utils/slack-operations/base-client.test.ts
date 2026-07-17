import { LogLevel, WebClient } from '@slack/web-api';
import pLimit from 'p-limit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BaseSlackClient,
  createSlackClientContext,
} from '../../../src/utils/slack-operations/base-client';

vi.mock('@slack/web-api', () => ({
  LogLevel: { ERROR: 'error' },
  WebClient: vi.fn(),
}));

class TestSlackClient extends BaseSlackClient {
  getState() {
    return {
      client: this.client,
      rateLimiter: this.rateLimiter,
      token: this.token,
    };
  }

  waitForRateLimit(error: unknown): Promise<void> {
    return this.handleRateLimit(error);
  }

  wait(ms: number): Promise<void> {
    return this.delay(ms);
  }
}

function mockConstructedWebClient(instance: unknown) {
  vi.mocked(WebClient).mockImplementation(
    class {
      constructor() {
        return instance;
      }
    } as never
  );
}

describe('base Slack client', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('creates a shared Slack client context from a token', () => {
    const webClient = { chat: {} };
    mockConstructedWebClient(webClient);

    const context = createSlackClientContext('xoxb-token');

    expect(WebClient).toHaveBeenCalledWith('xoxb-token', {
      retryConfig: { retries: 0 },
      logLevel: LogLevel.ERROR,
    });
    expect(context.client).toBe(webClient);
    expect(context.token).toBe('xoxb-token');
    expect(typeof context.rateLimiter).toBe('function');
  });

  it('accepts token, shared context, and raw WebClient dependencies', () => {
    const webClient = { chat: {} };
    mockConstructedWebClient(webClient);

    expect(new TestSlackClient('xoxb-token').getState()).toMatchObject({
      client: webClient,
      token: 'xoxb-token',
    });

    const sharedContext = {
      client: { files: {} } as never,
      rateLimiter: pLimit(1),
      token: 'shared-token',
    };
    expect(new TestSlackClient(sharedContext).getState()).toMatchObject({
      client: sharedContext.client,
      rateLimiter: sharedContext.rateLimiter,
      token: 'shared-token',
    });

    const rawClient = { users: {} } as never;
    const rawState = new TestSlackClient(rawClient).getState();
    expect(rawState.client).toBe(rawClient);
    expect(rawState.token).toBeUndefined();
    expect(typeof rawState.rateLimiter).toBe('function');
  });

  it('waits only for rate limit errors and exposes delay for subclasses', async () => {
    vi.useFakeTimers();
    const client = new TestSlackClient({ apiCall: vi.fn() } as never);

    const rateLimitPromise = client.waitForRateLimit(new Error('hit rate limit'));
    await vi.advanceTimersByTimeAsync(4999);
    let resolved = false;
    rateLimitPromise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(1);
    await rateLimitPromise;
    expect(resolved).toBe(true);

    await expect(client.waitForRateLimit(new Error('other error'))).resolves.toBeUndefined();

    const delayPromise = client.wait(25);
    await vi.advanceTimersByTimeAsync(25);
    await expect(delayPromise).resolves.toBeUndefined();
  });
});
