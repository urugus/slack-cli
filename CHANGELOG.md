# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2025-06-23

### Fixed
- Fixed unread message detection for channels where unread_count is 0 but messages exist after last_read timestamp
- Always check messages after last_read timestamp for accurate unread count
- Improved reliability of unread message detection for channels like dev_kiban_jira

## [0.2.0] - 2025-06-23

### Changed
- Major version bump for improved unread message detection

## [0.1.9] - 2025-06-22

### Fixed
- Improved unread message detection using last_read timestamp

## [0.1.8] - 2025-06-22

### Changed
- Refactored code organization with separation of concerns

## [0.1.7] - 2025-06-22

### Fixed
- Resolved rate limiting issues with `slack unread` command
- Disabled WebClient automatic retries to handle rate limits manually
- Changed to use users.conversations API for more efficient unread retrieval
- Added fallback mechanism for better compatibility

## [0.1.6] - 2025-06-22

### Added
- Channel resolver abstraction for better code reusability
- Output formatter abstraction for flexible display formats
- Rate limiting configuration with exponential backoff
- Better error messages with channel suggestions

### Changed
- Improved rate limiting handling to prevent infinite retry loops
- Extracted magic numbers into configuration constants
- Refactored SlackApiClient to reduce complexity

### Fixed
- Fixed infinite loop when hitting Slack API rate limits
- Replaced all `any` types with proper type definitions
- Fixed CommonJS compatibility issues with p-limit

## [0.1.5] - Previous releases

### Added
- Initial implementation of Slack CLI
- Support for sending messages
- Channel listing functionality
- Message history retrieval
- Unread message tracking
- Multi-profile support