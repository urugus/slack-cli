import { describe, expect, it } from 'vitest';
import { parseSlackMessageUrl } from '../../src/utils/slack-message-url';

describe('slack-message-url', () => {
  it('should parse a Slack message permalink', () => {
    expect(
      parseSlackMessageUrl('https://example.slack.com/archives/C123/p1780638511660849')
    ).toEqual({
      channel: 'C123',
      messageTs: '1780638511.660849',
      threadTs: undefined,
    });
  });

  it('should parse a Slack thread reply permalink', () => {
    expect(
      parseSlackMessageUrl(
        'https://example.slack.com/archives/C123/p1780638511660849?thread_ts=1780527015.228619'
      )
    ).toEqual({
      channel: 'C123',
      messageTs: '1780638511.660849',
      threadTs: '1780527015.228619',
    });
  });

  it('should reject invalid Slack message permalinks', () => {
    expect(() => parseSlackMessageUrl('https://example.com/not-a-message')).toThrow(
      'Invalid Slack message URL'
    );
  });
});
