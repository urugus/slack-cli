export const TOKEN_MASK_LENGTH = 4;
export const TOKEN_MIN_LENGTH = 9;
export const DEFAULT_PROFILE_NAME = 'default';

export const ERROR_MESSAGES = {
  NO_CONFIG: (profileName: string) =>
    `No configuration found for profile "${profileName}". Use "slack-cli config set --token <token> --profile ${profileName}" to set up.`,
  NO_MESSAGE_OR_FILE: 'You must specify either --message or --file',
  BOTH_MESSAGE_AND_FILE: 'Cannot use both --message and --file',
  PROFILE_NOT_FOUND: (profileName: string) => `Profile "${profileName}" not found`,
  NO_PROFILES_FOUND: 'No profiles found. Use "slack-cli config set --token <token>" to create one.',
} as const;

export const SUCCESS_MESSAGES = {
  TOKEN_SAVED: (profileName: string) => `Token saved successfully for profile "${profileName}"`,
  PROFILE_SWITCHED: (profileName: string) => `Switched to profile "${profileName}"`,
  PROFILE_CLEARED: (profileName: string) => `Profile "${profileName}" cleared successfully`,
  MESSAGE_SENT: (channel: string) => `Message sent successfully to #${channel}`,
} as const;