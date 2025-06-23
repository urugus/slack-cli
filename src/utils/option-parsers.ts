/**
 * Common option parsing utilities to reduce duplication
 */

/**
 * Parse format option with default value
 */
export function parseFormat(format?: string, defaultFormat = 'table'): string {
  return format || defaultFormat;
}

/**
 * Parse limit option with default value
 */
export function parseLimit(limit: string | undefined, defaultLimit: number): number {
  return parseInt(limit || defaultLimit.toString(), 10);
}

/**
 * Parse boolean option with default value
 */
export function parseBoolean(value?: boolean, defaultValue = false): boolean {
  return value !== undefined ? value : defaultValue;
}

/**
 * Parse count option with default value
 */
export function parseCount(
  count: string | undefined,
  defaultCount: number,
  min?: number,
  max?: number
): number {
  const parsed = parseInt(count || defaultCount.toString(), 10);

  if (isNaN(parsed)) {
    return defaultCount;
  }

  if (min !== undefined && parsed < min) {
    return min;
  }

  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
}

/**
 * Parse profile option
 */
export function parseProfile(profile?: string): string | undefined {
  return profile;
}

/**
 * Common option defaults
 */
export const OPTION_DEFAULTS = {
  format: 'table',
  limit: 100,
  countOnly: false,
  includeArchived: false,
} as const;

/**
 * Parse common list options
 */
export interface ListOptions {
  format?: string;
  limit?: string;
  countOnly?: boolean;
}

export interface ParsedListOptions {
  format: string;
  limit: number;
  countOnly: boolean;
}

export function parseListOptions(
  options: ListOptions,
  defaults?: Partial<ParsedListOptions>
): ParsedListOptions {
  const mergedDefaults = {
    format: OPTION_DEFAULTS.format,
    limit: OPTION_DEFAULTS.limit,
    countOnly: OPTION_DEFAULTS.countOnly,
    ...defaults,
  };

  return {
    format: parseFormat(options.format, mergedDefaults.format),
    limit: parseLimit(options.limit, mergedDefaults.limit),
    countOnly: parseBoolean(options.countOnly, mergedDefaults.countOnly),
  };
}
