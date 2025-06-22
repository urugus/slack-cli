# Changelog

All notable changes to this project will be documented in this file.

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