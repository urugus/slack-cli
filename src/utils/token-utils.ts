import { TOKEN_MASK_LENGTH, TOKEN_MIN_LENGTH } from './constants';

/**
 * Masks a token for display purposes, showing only first and last few characters
 * @param token The token to mask
 * @returns Masked token in format "xoxb-****-****-abcd"
 */
export function maskToken(token: string): string {
  if (token.length <= TOKEN_MIN_LENGTH) {
    return '****';
  }

  const prefix = token.substring(0, TOKEN_MASK_LENGTH);
  const suffix = token.substring(token.length - TOKEN_MASK_LENGTH);

  return `${prefix}-****-****-${suffix}`;
}
