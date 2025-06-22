export const TOKEN_MASK_LENGTH = 4;
export const TOKEN_MIN_LENGTH = 9;
export const DEFAULT_PROFILE_NAME = 'default';

export const ERROR_MESSAGES = {
  // Configuration errors
  NO_CONFIG: (profileName: string) =>
    `No configuration found for profile "${profileName}". Use "slack-cli config set --token <token> --profile ${profileName}" to set up.`,
  PROFILE_NOT_FOUND: (profileName: string) => `Profile "${profileName}" not found`,
  NO_PROFILES_FOUND: 'No profiles found. Use "slack-cli config set --token <token>" to create one.',
  INVALID_CONFIG_FORMAT: 'Invalid config file format',

  // Validation errors
  NO_MESSAGE_OR_FILE: 'You must specify either --message or --file',
  BOTH_MESSAGE_AND_FILE: 'Cannot use both --message and --file',

  // API errors
  API_ERROR: (error: string) => `API Error: ${error}`,
  CHANNEL_NOT_FOUND: (channel: string) => `Channel not found: ${channel}`,

  // File errors
  FILE_READ_ERROR: (file: string, error: string) => `Error reading file ${file}: ${error}`,
  FILE_NOT_FOUND: (file: string) => `File not found: ${file}`,

  // Channels command errors
  NO_CHANNELS_FOUND: 'No channels found',
  ERROR_LISTING_CHANNELS: (error: string) => `Error listing channels: ${error}`,
} as const;

export const SUCCESS_MESSAGES = {
  TOKEN_SAVED: (profileName: string) => `Token saved successfully for profile "${profileName}"`,
  PROFILE_SWITCHED: (profileName: string) => `Switched to profile "${profileName}"`,
  PROFILE_CLEARED: (profileName: string) => `Profile "${profileName}" cleared successfully`,
  MESSAGE_SENT: (channel: string) => `Message sent successfully to #${channel}`,
} as const;

// File and system constants
export const FILE_PERMISSIONS = {
  CONFIG_FILE: 0o600, // Read/write for owner only
};

// API limits
export const API_LIMITS = {
  MAX_MESSAGE_COUNT: 1000,
  MIN_MESSAGE_COUNT: 1,
  DEFAULT_MESSAGE_COUNT: 10,
};

// API Rate Limiting Configuration
export const RATE_LIMIT = {
  CONCURRENT_REQUESTS: 3,
  BATCH_SIZE: 10,
  BATCH_DELAY_MS: 1000,
  RETRY_CONFIG: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 30000,
  },
};

// Default values
export const DEFAULTS = {
  HISTORY_LIMIT: 20,
  CHANNELS_LIMIT: 1000,
  UNREAD_DISPLAY_LIMIT: 50,
};

// Time formats
export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
