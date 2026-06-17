# Slack CLI

[![npm version](https://img.shields.io/npm/v/@urugus/slack-cli)](https://www.npmjs.com/package/@urugus/slack-cli)
[![npm downloads](https://img.shields.io/npm/dm/@urugus/slack-cli)](https://www.npmjs.com/package/@urugus/slack-cli)

## Download Statistics

![npm monthly downloads](./assets/downloads.png)

A command-line tool for sending messages to Slack using the Slack API.

## Installation

```bash
npm install -g @urugus/slack-cli
```

By default, when you run commands, the CLI will show an update notification if a new npm release is available. To disable this, set `SLACK_CLI_DISABLE_UPDATE_NOTIFIER=1`.

## Configuration

You need to configure your Slack API token on first use:

```bash
# Interactive secure prompt (recommended)
slack-cli config set

# Non-interactive (CI/scripts)
printf '%s\n' "$SLACK_API_TOKEN" | slack-cli config set --token-stdin
```

Token storage security:
- Tokens are encrypted with AES-256-GCM before being written to disk.
- A local master key is created at `~/.slack-cli-secrets/master.key` with owner-only permissions.
- Existing `~/.slack-cli/master.key` files are migrated automatically on first use.
- For ephemeral environments, you can supply `SLACK_CLI_MASTER_KEY` to override the local key.
- Local encryption is defense in depth for token-at-rest storage. It does not protect tokens from compromise of the same local user account, because that user can read the config and key material needed to decrypt them.
- If a legacy encrypted token is migrated, the CLI will warn you to rotate the Slack token because the old stored value may have been copied, backed up, or exposed before migration.

## Usage

### Managing Multiple Workspaces (Profiles)

```bash
# Set tokens for different workspaces
printf '%s\n' "$WORK_SLACK_TOKEN" | slack-cli config set --profile work --token-stdin
printf '%s\n' "$PERSONAL_SLACK_TOKEN" | slack-cli config set --profile personal --token-stdin

# Show all profiles
slack-cli config profiles

# Switch default profile
slack-cli config use work

# Show current active profile
slack-cli config current

# Show configuration for specific profile
slack-cli config get --profile personal

# Clear specific profile
slack-cli config clear --profile work
```

### Sending Messages

```bash
# Basic usage (uses default profile)
slack-cli send -c channel-name -m "Your message here"

# Using specific profile
slack-cli send -c channel-name -m "Your message here" --profile personal

# Using channel ID
slack-cli send -c C1234567890 -m "Your message here"

# Multi-line message
slack-cli send -c general -m "Line 1\nLine 2\nLine 3"

# Send message from file
slack-cli send -c random -f message.txt

# Reply to a thread
slack-cli send -c channel-name -m "Reply message" --thread 1719207629.000100

# Reply to a thread (short option)
slack-cli send -c channel-name -m "Reply message" -t 1719207629.000100

# Schedule by absolute time (Unix seconds or ISO 8601)
slack-cli send -c channel-name -m "Scheduled message" --at "2026-03-01T09:00:00Z"

# Schedule after N minutes
slack-cli send -c channel-name -m "Scheduled message" --after 30

# Send DM by username
slack-cli send --user @john -m "Hello via DM!"

# Send DM by email
slack-cli send --email john@example.com -m "Hello via DM!"
```

### Assistant Thread Status

Slack's `assistant.threads.setStatus` API can show a temporary loading status such as
`<App name> is thinking...` on a normal channel thread. Since Slack's 2026-03-05
change, this works with the `chat:write` scope.

```bash
# Set status on a thread
slack-cli status set -c channel-name -t 1719207629.000100 --text "Working on it"

# Set status with rotating loading messages
slack-cli status set -c channel-name -t 1719207629.000100 --text "Working on it" \
  --loading-message "Reading context" \
  --loading-message "Calling tools"

# Clear status
slack-cli status clear -c channel-name -t 1719207629.000100

# Keep status alive until max duration, stop file, or SIGINT/SIGTERM
slack-cli status keep-alive -c channel-name -t 1719207629.000100 --text "Working on it" \
  --interval 80 \
  --max-duration 600 \
  --stop-file /tmp/slack-cli-status.stop

# Keep status alive with dynamic status text from a file
slack-cli status keep-alive -c channel-name -t 1719207629.000100 --text "Working on it" \
  --text-file /tmp/slack-cli-status.txt \
  --interval 80 \
  --max-duration 600 \
  --stop-file /tmp/slack-cli-status.stop

# Run keep-alive in the background, record its PID, and log activity to a file
slack-cli status keep-alive -c channel-name -t 1719207629.000100 --text "Working on it" \
  --interval 80 \
  --max-duration 600 \
  --stop-file /tmp/slack-cli-status.stop \
  --detach \
  --pid-file /tmp/slack-cli-status.pid \
  --log-file /tmp/slack-cli-status.log

# Stop a background keep-alive process and clear status as a backstop
slack-cli status stop -c channel-name -t 1719207629.000100 \
  --stop-file /tmp/slack-cli-status.stop \
  --pid-file /tmp/slack-cli-status.pid
```

### List Channels

```bash
# List all channels (uses default profile)
slack-cli channels

# List channels from specific profile
slack-cli channels --profile work

# List public channels only
slack-cli channels --type public

# List private channels only
slack-cli channels --type private

# List all channel types including IMs and MPIMs
slack-cli channels --type all

# Include archived channels
slack-cli channels --include-archived

# Limit number of channels displayed
slack-cli channels --limit 20

# Output in different formats
slack-cli channels --format json
slack-cli channels --format simple
```

### Channel Info & Management

```bash
# Display channel details (topic, purpose, members, etc.)
slack-cli channel info -c general

# Output channel info in different formats
slack-cli channel info -c general --format json
slack-cli channel info -c general --format simple

# Set channel topic
slack-cli channel set-topic -c general --topic "Current sprint: v2.0"

# Set channel purpose
slack-cli channel set-purpose -c general --purpose "Project X development channel"
```

### View Message History

```bash
# Get latest 10 messages (default)
slack-cli history -c general

# Specify number of messages
slack-cli history -c general -n 20

# Get messages since specific date
slack-cli history -c general --since "2024-01-01 00:00:00"

# Get complete conversation of a thread
slack-cli history -c general --thread 1719207629.000100

# Get a single message from a Slack permalink
slack-cli history --url "https://example.slack.com/archives/C123/p1780638511660849"

# Extract table blocks from a Slack permalink
slack-cli history --url "https://example.slack.com/archives/C123/p1780638511660849" --tables

# Extract table blocks as JSON
slack-cli history --url "https://example.slack.com/archives/C123/p1780638511660849" --tables --table-format json

# Output in different formats
slack-cli history -c general --format json
slack-cli history -c general --format simple

# Include permalink for each message
slack-cli history -c general --with-link

# Use specific profile
slack-cli history -c general --profile work
```

### Get Unread Messages

```bash
# Get all unread messages across all channels
slack-cli unread

# Get unread messages from specific channel
slack-cli unread -c general

# Show only unread counts (no message content)
slack-cli unread --count-only

# Mark messages as read after fetching
slack-cli unread --mark-read

# Mark messages as read for specific channel
slack-cli unread -c general --mark-read

# Limit number of channels displayed
slack-cli unread --limit 10

# Output in different formats
slack-cli unread --format json
slack-cli unread --format simple
```

### Search Messages

```bash
# Basic search
slack-cli search -q "deploy error"

# Sort by timestamp (newest first)
slack-cli search -q "meeting" --sort timestamp

# Sort oldest first
slack-cli search -q "release" --sort timestamp --sort-dir asc

# Limit results per page
slack-cli search -q "bug fix" -n 50

# Paginate through results
slack-cli search -q "deploy" --page 2

# Use Slack search modifiers in query
slack-cli search -q "in:general from:@alice deploy"

# Output in different formats
slack-cli search -q "error" --format json
slack-cli search -q "error" --format simple

# Use specific profile
slack-cli search -q "release" --profile work
```

### Edit Messages

```bash
# Edit a sent message
slack-cli edit -c general --ts 1234567890.123456 -m "Updated message text"

# Use specific profile
slack-cli edit -c general --ts 1234567890.123456 -m "Fixed typo" --profile work
```

### Delete Messages

```bash
# Delete a message
slack-cli delete -c general --ts 1234567890.123456

# Use specific profile
slack-cli delete -c general --ts 1234567890.123456 --profile work
```

### Upload Files

```bash
# Upload a file
slack-cli upload -c general -f ./report.csv

# Upload with title and initial comment
slack-cli upload -c general -f ./report.csv --title "Daily Report" -m "Here is the report"

# Upload a text snippet
slack-cli upload -c general --content 'console.log("hello")' --filename snippet.js --filetype javascript

# Upload as a thread reply
slack-cli upload -c general -f ./logs.txt -t 1234567890.123456
```

### Download Files

```bash
# Download the first file attached to a Slack message URL
slack-cli file download --url "https://example.slack.com/archives/C123/p1780530261218279?thread_ts=1780527015.228619" --dir ./downloads

# Download by Slack file ID
slack-cli file download --id F012ABCDEF --output ./image.png

# Download a file from a message timestamp
slack-cli file download -c C123 -t 1780530261.218279 --thread 1780527015.228619 --index 1
```

### Reactions

```bash
# Add a reaction to a message
slack-cli reaction add -c general -t 1234567890.123456 -e thumbsup

# Remove a reaction from a message
slack-cli reaction remove -c general -t 1234567890.123456 -e thumbsup
```

### Pins

```bash
# Pin a message
slack-cli pin add -c general -t 1234567890.123456

# Unpin a message
slack-cli pin remove -c general -t 1234567890.123456

# List pinned items in a channel
slack-cli pin list -c general

# Output in different formats
slack-cli pin list -c general --format json
slack-cli pin list -c general --format simple
```

### Users

```bash
# List workspace users
slack-cli users list

# Limit number of users
slack-cli users list --limit 50

# Output in different formats
slack-cli users list --format json
slack-cli users list --format simple

# Get detailed info for a specific user
slack-cli users info --id U01ABCDEF

# Look up user by email address
slack-cli users lookup --email user@example.com

# Use specific profile
slack-cli users list --profile work
```

### Scheduled Messages

```bash
# List scheduled messages
slack-cli scheduled list

# Filter by channel
slack-cli scheduled list -c general

# Limit results
slack-cli scheduled list --limit 20

# Output in different formats
slack-cli scheduled list --format json
slack-cli scheduled list --format simple

# Cancel a scheduled message
slack-cli scheduled cancel -c general --id Q1298393284
```

### Canvases

```bash
# Get sections of a Canvas
slack-cli canvas read -i F01234567890

# Output in different formats
slack-cli canvas read -i F01234567890 --format json
slack-cli canvas read -i F01234567890 --format simple

# List canvases linked to a channel
slack-cli canvas list -c general

# Output in different formats
slack-cli canvas list -c general --format json
slack-cli canvas list -c general --format simple

# Append markdown to an existing Canvas
slack-cli canvas write -i F01234567890 -m "追記する内容"

# Insert markdown at the start of an existing Canvas
slack-cli canvas write -i F01234567890 -m "先頭に追加" --position start

# Replace the entire Canvas content
# This discards the current Canvas content and requires --yes.
slack-cli canvas write -i F01234567890 -m "全体を置換" --position replace --yes

# Use specific profile
slack-cli canvas read -i F01234567890 --profile work
slack-cli canvas list -c general --profile work
slack-cli canvas write -i F01234567890 -m "追記する内容" --profile work
```

### Other Commands

```bash
# Show help
slack-cli --help

# Show version
slack-cli --version

# Show current configuration
slack-cli config get

# Update token for default profile
printf '%s\n' "$NEW_TOKEN" | slack-cli config set --token-stdin
```

## Options

### Global Options

| Option    | Short | Description                    |
| --------- | ----- | ------------------------------ |
| --profile | -p    | Use specific workspace profile |

### send command

| Option    | Short | Description                              |
| --------- | ----- | ---------------------------------------- |
| --channel | -c    | Target channel name or ID (required)     |
| --message | -m    | Message to send                          |
| --file    | -f    | File containing message content          |
| --thread  | -t    | Thread timestamp to reply to             |
| --blocks  |       | Block Kit blocks as a JSON array         |
| --blocks-file |   | File containing Block Kit blocks JSON    |
| --at      |       | Schedule time (Unix seconds or ISO 8601) |
| --after   |       | Schedule message after N minutes         |
### Block Kit メッセージ送信

```bash
# blocks を直接指定 (-m は通知用 fallback text になる)
slack-cli send -c general --blocks '[{"type":"section","text":{"type":"mrkdwn","text":"*hello*"}}]' -m "hello"

# ファイルから読み込み
slack-cli send -c general --blocks-file ./blocks.json -m "fallback"

# スレッド返信・予約送信とも併用可能
slack-cli send -c general -t 1234567890.123456 --blocks '[{"type":"divider"}]'
```

- `--blocks` と `--blocks-file` は排他
- blocks は「`type` を持つ object の JSON 配列」であることを送信前に検証する


### status command

Subcommands: `set`, `clear`, `keep-alive`, `stop`

#### status set

| Option            | Short | Description                                      |
| ----------------- | ----- | ------------------------------------------------ |
| --channel         | -c    | Target channel name or ID (required)             |
| --thread          | -t    | Thread parent timestamp (required)               |
| --text            |       | Status text (required)                           |
| --loading-message |       | Optional loading message; repeatable up to 10    |
| --profile         |       | Use specific workspace profile                   |

#### status clear

| Option    | Short | Description                          |
| --------- | ----- | ------------------------------------ |
| --channel | -c    | Target channel name or ID (required) |
| --thread  | -t    | Thread parent timestamp (required)   |
| --profile |       | Use specific workspace profile       |

#### status keep-alive

Refreshes status immediately and then every `--interval` seconds because Slack clears assistant
thread status after roughly two minutes. It stops when `--max-duration` elapses, `--stop-file`
exists, or SIGINT/SIGTERM is received. Stop-file checks run at least every 5 seconds even when
the refresh interval is longer. Every exit path sends a final clear request; clear failures are
ignored.

With `--text-file`, the CLI reads status text from the file on each 5-second poll. Non-empty
file content overrides `--text`; missing, empty, or unreadable files fall back to `--text`.
When the resolved text changes, keep-alive sends the new status immediately instead of waiting
for the next `--interval` refresh.

With `--detach`, the CLI starts the same keep-alive command in a detached child process without
`--detach`, writes the child PID to `--pid-file`, and exits immediately. Without `--detach`,
`--pid-file` writes the foreground process PID and is removed when keep-alive exits.

With `--log-file`, keep-alive appends timestamped activity logs to the file: startup parameters,
each `setStatus` success or failure with the error message, status text changes detected from
`--text-file`, and the stop reason. The option is passed through to the detached child, so
`--detach` runs stay traceable even though the child runs with `stdio: 'ignore'`. Log writes are
best-effort and never interrupt keep-alive.

| Option            | Short | Description                                           |
| ----------------- | ----- | ----------------------------------------------------- |
| --channel         | -c    | Target channel name or ID (required)                  |
| --thread          | -t    | Thread parent timestamp (required)                    |
| --text            |       | Status text (required)                                |
| --text-file       |       | Read dynamic status text from this file               |
| --interval        |       | Refresh interval in seconds (default: 80)             |
| --max-duration    |       | Maximum duration in seconds (default: 600)            |
| --stop-file       |       | Stop when this path exists                            |
| --detach          |       | Run keep-alive in a detached background process       |
| --pid-file        |       | Write the keep-alive process ID to this file          |
| --log-file        |       | Append timestamped activity logs to this file         |
| --loading-message |       | Optional loading message; repeatable up to 10         |
| --profile         |       | Use specific workspace profile                        |

#### status stop

Creates the optional stop-file, terminates the optional pid-file process with SIGTERM and then
SIGKILL after `--timeout`, removes the pid-file, and finally clears status as a backstop. Missing
files, dead processes, kill failures, and clear failures only print warnings; the command exits 0.

| Option      | Short | Description                                   |
| ----------- | ----- | --------------------------------------------- |
| --channel   | -c    | Target channel name or ID (required)          |
| --thread    | -t    | Thread parent timestamp (required)            |
| --stop-file |       | Create this stop file before stopping         |
| --pid-file  |       | Read and stop the process ID from this file   |
| --timeout   |       | Seconds before SIGKILL after SIGTERM (default: 5) |
| --profile   |       | Use specific workspace profile                |

### channels command

| Option             | Short | Description                                                    |
| ------------------ | ----- | -------------------------------------------------------------- |
| --type             |       | Channel type: public, private, im, mpim, all (default: public) |
| --include-archived |       | Include archived channels                                      |
| --format           |       | Output format: table, simple, json (default: table)            |
| --limit            |       | Maximum number of channels to list (default: 100)              |

### history command

| Option         | Short | Description                                            |
| -------------- | ----- | ------------------------------------------------------ |
| --url          |       | Slack message permalink to retrieve                    |
| --channel      | -c    | Target channel name or ID                              |
| --number       | -n    | Number of messages to retrieve (default: 10)           |
| --since        |       | Get messages since specific date (YYYY-MM-DD HH:MM:SS) |
| --thread       | -t    | Thread timestamp to retrieve complete thread messages   |
| --format       |       | Output format: table, simple, json (default: table)    |
| --tables       |       | Extract table blocks from retrieved messages           |
| --table-format |       | Table output format: markdown, json, tsv               |

### unread command

| Option       | Short | Description                                         |
| ------------ | ----- | --------------------------------------------------- |
| --channel    | -c    | Get unread for specific channel                     |
| --format     |       | Output format: table, simple, json (default: table) |
| --count-only |       | Show only unread counts                             |
| --limit      |       | Maximum number of channels to display (default: 50) |
| --mark-read  |       | Mark messages as read after fetching                |

### search command

| Option     | Short | Description                                         |
| ---------- | ----- | --------------------------------------------------- |
| --query    | -q    | Search query (required)                             |
| --sort     |       | Sort by: score or timestamp (default: score)        |
| --sort-dir |       | Sort direction: asc or desc (default: desc)         |
| --number   | -n    | Number of results per page, 1-100 (default: 20)     |
| --page     |       | Page number, 1-100 (default: 1)                     |
| --format   |       | Output format: table, simple, json (default: table) |

### edit command

| Option    | Short | Description                                    |
| --------- | ----- | ---------------------------------------------- |
| --channel | -c    | Target channel name or ID (required)           |
| --ts      |       | Message timestamp to edit (required)           |
| --message | -m    | New message text (required)                    |

### delete command

| Option    | Short | Description                                    |
| --------- | ----- | ---------------------------------------------- |
| --channel | -c    | Target channel name or ID (required)           |
| --ts      |       | Message timestamp to delete (required)         |

### upload command

| Option     | Short | Description                                      |
| ---------- | ----- | ------------------------------------------------ |
| --channel  | -c    | Target channel name or ID (required)             |
| --file     | -f    | File path to upload                              |
| --content  |       | Text content to upload as snippet                |
| --filename |       | Override filename                                |
| --title    |       | File title                                       |
| --message  | -m    | Initial comment with the file                    |
| --filetype |       | Snippet type (e.g. python, javascript, csv)      |
| --thread   | -t    | Thread timestamp to upload as reply              |

### file download command

| Option      | Short | Description                                      |
| ----------- | ----- | ------------------------------------------------ |
| --id        |       | Slack file ID                                    |
| --url       |       | Slack message permalink containing the file      |
| --channel   | -c    | Channel name or ID                               |
| --timestamp | -t    | Message timestamp containing the file            |
| --thread    |       | Thread timestamp when downloading from a reply   |
| --index     |       | 1-based file index for messages with many files  |
| --output    | -o    | Output file path                                 |
| --dir       | -d    | Output directory                                 |

### reaction command

| Option      | Short | Description                              |
| ----------- | ----- | ---------------------------------------- |
| --channel   | -c    | Channel name or ID (required)            |
| --timestamp | -t    | Message timestamp (required)             |
| --emoji     | -e    | Emoji name without colons (required)     |

Subcommands: `add`, `remove`

### pin command

Subcommands: `add`, `remove`, `list`

#### pin add / pin remove

| Option      | Short | Description                          |
| ----------- | ----- | ------------------------------------ |
| --channel   | -c    | Channel name or ID (required)        |
| --timestamp | -t    | Message timestamp (required)         |

#### pin list

| Option    | Short | Description                                         |
| --------- | ----- | --------------------------------------------------- |
| --channel | -c    | Channel name or ID (required)                       |
| --format  |       | Output format: table, simple, json (default: table) |

### users command

Subcommands: `list`, `info`, `lookup`

#### users list

| Option   | Short | Description                                         |
| -------- | ----- | --------------------------------------------------- |
| --limit  |       | Maximum number of users to list (default: 100)      |
| --format |       | Output format: table, simple, json (default: table) |

#### users info

| Option   | Short | Description                                         |
| -------- | ----- | --------------------------------------------------- |
| --id     |       | User ID (required)                                  |
| --format |       | Output format: table, simple, json (default: table) |

#### users lookup

| Option   | Short | Description                                         |
| -------- | ----- | --------------------------------------------------- |
| --email  |       | Email address to look up (required)                 |
| --format |       | Output format: table, simple, json (default: table) |

### scheduled command

Subcommands: `list`, `cancel`

#### scheduled list

| Option    | Short | Description                                                |
| --------- | ----- | ---------------------------------------------------------- |
| --channel | -c    | Filter by channel name or ID                               |
| --limit   |       | Maximum number of scheduled messages to list (default: 50) |
| --format  |       | Output format: table, simple, json (default: table)        |

#### scheduled cancel

| Option    | Short | Description                             |
| --------- | ----- | --------------------------------------- |
| --channel | -c    | Channel name or ID (required)           |
| --id      |       | Scheduled message ID (required)         |

### canvas command

Subcommands: `read`, `list`, `write`

#### canvas read

| Option   | Short | Description                                         |
| -------- | ----- | --------------------------------------------------- |
| --id     | -i    | Canvas ID (required)                                |
| --format |       | Output format: table, simple, json (default: table) |

#### canvas list

| Option    | Short | Description                                         |
| --------- | ----- | --------------------------------------------------- |
| --channel | -c    | Channel name or ID (required)                       |
| --format  |       | Output format: table, simple, json (default: table) |

#### canvas write

Writes markdown to an existing Canvas. It does not create a new Canvas.

| Option     | Short | Description                                                       |
| ---------- | ----- | ----------------------------------------------------------------- |
| --id       | -i    | Canvas ID (required)                                              |
| --message  | -m    | Markdown content to write (required)                              |
| --position |       | Write position: end, start, replace (default: end)                |
| --yes      |       | Required when --position replace discards the whole Canvas content |
| --profile  |       | Use specific workspace profile                                    |

## Required Permissions

Your Slack API token needs the following scopes:

- `chat:write` - Send and edit messages; also required for `status` commands using Slack's `assistant.threads.setStatus` API
- `channels:read` - List public channels and get channel info
- `channels:write` - Set topic/purpose for public channels
- `groups:read` - List private channels and get channel info
- `groups:write` - Set topic/purpose for private channels
- `channels:history` - Read channel message history
- `groups:history` - Read private channel message history
- `im:history` - Read direct message history
- `im:write` - Open DM channels for --user/--email DM sending
- `users:read` - Access user information for unread counts and user listing
- `users:read.email` - Look up users by email address
- `search:read` - Search messages (user token only, not supported with bot tokens)
- `reactions:write` - Add and remove reactions
- `pins:read` - List pinned items in a channel
- `pins:write` - Pin and unpin messages
- `files:write` - Upload files and snippets
- `files:read` - Download Slack files and list canvases linked to a channel
- `canvases:read` - Read Canvas sections
- `canvases:write` - Write Canvas content

## Advanced Features

### Rate Limiting

The CLI includes built-in rate limiting to handle Slack API limits:

- Concurrent requests: 3
- Automatic retry with exponential backoff (max 3 retries)
- Graceful error handling for rate limit errors

### Output Formats

Most commands support multiple output formats:

- `table` (default) - Human-readable table format
- `simple` - Simplified text output
- `json` - Machine-readable JSON format

### Markdown Support

Messages sent via the `send` command automatically support Slack's mrkdwn formatting:

- `*bold*` for bold text
- `_italic_` for italic text
- `~strikethrough~` for strikethrough
- `` `code` `` for inline code
- ` ```code blocks``` ` for multiline code
- Links are automatically hyperlinked
- User mentions: `<@USER_ID>`
- Channel mentions: `<#CHANNEL_ID>`

## License

MIT

