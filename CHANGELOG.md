# Changelog

All notable changes to this project will be documented in this file.

## [0.25.1] - 2026-06-14

### Added
- Expand test coverage across command validation, Slack operation wrappers, formatter helpers, update checks, token encryption, and Dependabot risk evaluation

### Fixed
- Preserve valid channel creation timestamps when `created` is `0`, and emit `null` in channels JSON output when Slack omits the creation timestamp
- Reject using the same path for `status keep-alive --pid-file` and `--log-file`

## [0.25.0] - 2026-06-12

### Added
- Add `status keep-alive --log-file` to append timestamped activity logs (start, setStatus success/failure, text changes, stop reason) for observability of detached keep-alive processes

## [0.24.0] - 2026-06-12

### Added
- Add `status keep-alive --text-file` for dynamic status text with `--text` fallback
- Refresh keep-alive status immediately when text-file content changes during the 5-second poll loop

## [0.23.1] - 2026-06-12

### Added
- Add `status keep-alive --detach` and `--pid-file` for CLI-managed background keep-alive processes
- Add `status stop` to touch stop files, terminate keep-alive PIDs, and clear status as a backstop
- Check keep-alive stop files at least every 5 seconds even when refresh intervals are longer

## [0.23.0] - 2026-06-12

### Added
- Add `status` command for Slack `assistant.threads.setStatus`
- Support `status set`, `status clear`, and `status keep-alive`
- Support repeated `--loading-message` values, up to Slack's 10 message limit

## [0.4.4] - 2026-02-22

### Changed
- Replace generic `Error` with `ConfigurationError` in `TokenCryptoService` (encrypt/decrypt failures)
- Replace generic `Error` with `ValidationError` in `TokenCryptoService` (invalid data format validation)
- Replace generic `Error` with `ConfigurationError` in `ProfileConfigManager` (profile not found, invalid config)
- Replace generic `Error` with `ValidationError` in `createOptionParser` (validation failures)
- Replace generic `Error` with `ApiError` in `ChannelResolver` (channel not found errors)

### Added
- Error type verification tests for `TokenCryptoService`, `ProfileConfigManager`, `ChannelResolver`, and `createOptionParser`

## [0.4.3] - 2026-02-22

### Changed
- Replace `any` types with proper TypeScript types in `MessageFormatterOptions` (`Channel`, `Message[]`)
- Replace `any` type in `JsonMessageFormatter` output with explicit `MessageJsonOutput` interface
- Replace `as any` cast in `MessageOperations.listScheduledMessages` with `ChatScheduledMessagesListArguments`
- Replace `Promise<any>` return type in `ChannelOperations.fetchLatestMessage` with `Promise<Message | null>`
- Replace `TOutput = any` default in `JsonFormatter` base class with `TOutput = unknown`

### Added
- New test file for message formatters (`tests/utils/formatters/message-formatters.test.ts`)

## [0.4.2] - 2026-02-22

### Changed
- Consolidated duplicate configuration management systems into a single `ProfileConfigManager`
- Integrated `TokenCryptoService` into `ProfileConfigManager` for automatic token encryption at rest
- Tokens are now encrypted (AES-256-CBC) when saved and decrypted when read
- Existing plaintext tokens are still readable for backward compatibility
- Old config format migration now also encrypts tokens

### Removed
- Removed unused `ConfigFileManager` class (`src/utils/config/config-file-manager.ts`)
- Removed unused `ProfileManager` class (`src/utils/config/profile-manager.ts`)
- Removed duplicate test file (`tests/utils/config.test.ts`)

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
