import { describe, expect, it } from 'vitest';
import {
  API_LIMITS,
  DEFAULT_PROFILE_NAME,
  DEFAULTS,
  ERROR_MESSAGES,
  FILE_PERMISSIONS,
  RATE_LIMIT,
  SUCCESS_MESSAGES,
  TIME_FORMAT,
  TOKEN_MASK_LENGTH,
  TOKEN_MIN_LENGTH,
} from '../../src/utils/constants';

describe('constants', () => {
  it('exposes expected scalar configuration values', () => {
    expect(TOKEN_MASK_LENGTH).toBe(4);
    expect(TOKEN_MIN_LENGTH).toBe(9);
    expect(DEFAULT_PROFILE_NAME).toBe('default');
    expect(FILE_PERMISSIONS.CONFIG_DIR).toBe(0o700);
    expect(FILE_PERMISSIONS.CONFIG_FILE).toBe(0o600);
    expect(API_LIMITS.MIN_MESSAGE_COUNT).toBe(1);
    expect(RATE_LIMIT.CONCURRENT_REQUESTS).toBeGreaterThan(0);
    expect(DEFAULTS.CHANNELS_LIMIT).toBeGreaterThan(0);
    expect(TIME_FORMAT).toBe('YYYY-MM-DD HH:mm:ss');
  });

  it('formats error and success messages', () => {
    expect(ERROR_MESSAGES.NO_CONFIG('work')).toContain('profile "work"');
    expect(ERROR_MESSAGES.PROFILE_NOT_FOUND('work')).toBe('Profile "work" not found');
    expect(ERROR_MESSAGES.API_ERROR('invalid_auth')).toBe('API Error: invalid_auth');
    expect(ERROR_MESSAGES.CHANNEL_NOT_FOUND('general')).toBe('Channel not found: general');
    expect(ERROR_MESSAGES.FILE_READ_ERROR('msg.txt', 'denied')).toBe(
      'Error reading file msg.txt: denied'
    );
    expect(ERROR_MESSAGES.FILE_NOT_FOUND('msg.txt')).toBe('File not found: msg.txt');
    expect(ERROR_MESSAGES.ERROR_LISTING_CHANNELS('rate_limited')).toBe(
      'Error listing channels: rate_limited'
    );

    expect(SUCCESS_MESSAGES.TOKEN_SAVED('work')).toContain('profile "work"');
    expect(SUCCESS_MESSAGES.PROFILE_SWITCHED('work')).toContain('profile "work"');
    expect(SUCCESS_MESSAGES.PROFILE_CLEARED('work')).toContain('Profile "work"');
    expect(SUCCESS_MESSAGES.MESSAGE_SENT('general')).toContain('#general');
    expect(SUCCESS_MESSAGES.MESSAGE_SCHEDULED('general', '2026-06-14T00:00:00.000Z')).toContain(
      '#general'
    );
    expect(SUCCESS_MESSAGES.EPHEMERAL_MESSAGE_SENT('general')).toContain('#general');
  });
});
