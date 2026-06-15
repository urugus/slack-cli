import { describe, expect, it } from 'vitest';
import {
  formatChannelName,
  getChannelTypes,
  mapChannelToInfo,
} from '../../src/utils/channel-formatter';

describe('channel-formatter', () => {
  it('maps Slack channel variants to display info', () => {
    expect(
      mapChannelToInfo({
        id: 'C1',
        name: '\u001b[31mgeneral\u001b[0m',
        is_channel: true,
        is_private: false,
        num_members: 12,
        created: 65,
        purpose: { value: '\u001b[31mannouncements\u001b[0m' },
      })
    ).toMatchObject({
      id: 'C1',
      name: 'general',
      type: 'public',
      members: 12,
      purpose: 'announcements',
    });

    expect(mapChannelToInfo({ id: 'G1', is_group: true }).type).toBe('private');
    expect(mapChannelToInfo({ id: 'D1', is_im: true }).type).toBe('im');
    expect(mapChannelToInfo({ id: 'M1', is_mpim: true }).type).toBe('mpim');
    expect(mapChannelToInfo({ id: 'X1' }).type).toBe('unknown');
    expect(mapChannelToInfo({ id: 'X1' }).name).toBe('unnamed');
    expect(mapChannelToInfo({ id: 'X1' }).created).toBe('');
    expect(mapChannelToInfo({ id: 'X1', created: 0 }).created).toBe('1970-01-01');
  });

  it('formats channel names safely', () => {
    expect(formatChannelName()).toBe('#unknown');
    expect(formatChannelName('general')).toBe('#general');
    expect(formatChannelName('#random')).toBe('#random');
    expect(formatChannelName('\u001b[31mops\u001b[0m')).toBe('#ops');
  });

  it('maps command channel type names to Slack API type filters', () => {
    expect(getChannelTypes('public')).toBe('public_channel');
    expect(getChannelTypes('private')).toBe('private_channel');
    expect(getChannelTypes('im')).toBe('im');
    expect(getChannelTypes('mpim')).toBe('mpim');
    expect(getChannelTypes('all')).toBe('public_channel,private_channel,mpim,im');
    expect(getChannelTypes('unknown')).toBe('public_channel');
  });
});
