/**
 * Common regex patterns for Slack message parsing
 */

// Matches Slack user mentions in the format <@USERID>
export const USER_MENTION_PATTERN = /<@([A-Z0-9]+)>/g;

// Matches Slack user mentions with valid user ID shapes for API lookups
export const VALID_USER_MENTION_PATTERN = /<@([UW][A-Z0-9]{8,})>/g;

// Matches a single user mention (non-global)
export const SINGLE_USER_MENTION_PATTERN = /<@([A-Z0-9]+)>/;
