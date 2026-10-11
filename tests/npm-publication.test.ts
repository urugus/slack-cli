import { describe, expect, it, vi } from 'vitest';
import { isPublished } from '../scripts/check-npm-publication.cjs';

describe('npm release retry check', () => {
  it('finds an already published exact version', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '0.30.0' })));
    expect(await isPublished('@urugus/slack-cli', '0.30.0', fetcher)).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://registry.npmjs.org/%40urugus%2Fslack-cli/0.30.0'
    );
  });

  it('retries publication when only the GitHub tag exists', async () => {
    expect(
      await isPublished(
        '@urugus/slack-cli',
        '0.30.0',
        vi.fn().mockResolvedValue(new Response('', { status: 404 }))
      )
    ).toBe(false);
  });

  it.each([401, 403, 429, 500, 503])('fails closed on registry status %s', async (status) => {
    await expect(
      isPublished(
        '@urugus/slack-cli',
        '0.30.0',
        vi.fn().mockResolvedValue(new Response('', { status }))
      )
    ).rejects.toThrow(String(status));
  });

  it('propagates connection errors', async () => {
    await expect(
      isPublished('@urugus/slack-cli', '0.30.0', vi.fn().mockRejectedValue(new Error('offline')))
    ).rejects.toThrow('offline');
  });

  it('rejects mismatched registry metadata', async () => {
    await expect(
      isPublished(
        '@urugus/slack-cli',
        '0.30.0',
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: '0.27.1' })))
      )
    ).rejects.toThrow('version');
  });

  it('rejects malformed registry responses', async () => {
    await expect(
      isPublished(
        '@urugus/slack-cli',
        '0.30.0',
        vi.fn().mockResolvedValue(new Response('not JSON'))
      )
    ).rejects.toThrow();
  });
});
