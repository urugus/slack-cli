import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from '../../src/utils/error-utils';

describe('extractErrorMessage', () => {
  it('should extract message from Error instance', () => {
    const error = new Error('Test error message');
    expect(extractErrorMessage(error)).toBe('Test error message');
  });

  it('should convert string to string', () => {
    const error = 'String error';
    expect(extractErrorMessage(error)).toBe('String error');
  });

  it('should convert number to string', () => {
    const error = 404;
    expect(extractErrorMessage(error)).toBe('404');
  });

  it('should convert object to string', () => {
    const error = { code: 'ERROR_CODE', detail: 'Some detail' };
    expect(extractErrorMessage(error)).toBe('[object Object]');
  });

  it('should handle null', () => {
    const error = null;
    expect(extractErrorMessage(error)).toBe('null');
  });

  it('should handle undefined', () => {
    const error = undefined;
    expect(extractErrorMessage(error)).toBe('undefined');
  });
});