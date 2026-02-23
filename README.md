# Slack CLI

A command-line tool for sending messages to Slack using the Slack API.

## Installation

```bash
npm install -g @urugus/slack-cli
```

## Configuration

You need to configure your Slack API token on first use:

```bash
slack-cli config set --token YOUR_SLACK_API_TOKEN
```

## Usage

### Managing Multiple Workspaces (Profiles)

```bash
# Set tokens for different workspaces
slack-cli config set --profile work --token xoxb-work-token
slack-cli config set --profile personal --token xoxb-personal-token

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

# Output in different formats
slack-cli history -c general --format json
slack-cli history -c general --format simple

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

### Other Commands

```bash
# Show help
slack-cli --help

# Show version
slack-cli --version

# Show current configuration
slack-cli config get

# Update token for default profile
slack-cli config set --token NEW_TOKEN
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
| --at      |       | Schedule time (Unix seconds or ISO 8601) |
| --after   |       | Schedule message after N minutes         |

### channels command

| Option             | Short | Description                                                    |
| ------------------ | ----- | -------------------------------------------------------------- |
| --type             |       | Channel type: public, private, im, mpim, all (default: public) |
| --include-archived |       | Include archived channels                                      |
| --format           |       | Output format: table, simple, json (default: table)            |
| --limit            |       | Maximum number of channels to list (default: 100)              |

### history command

| Option    | Short | Description                                            |
| --------- | ----- | ------------------------------------------------------ |
| --channel | -c    | Target channel name or ID (required)                   |
| --number  | -n    | Number of messages to retrieve (default: 10)           |
| --since   |       | Get messages since specific date (YYYY-MM-DD HH:MM:SS) |
| --thread  | -t    | Thread timestamp to retrieve complete thread messages   |
| --format  |       | Output format: table, simple, json (default: table)    |

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

## Required Permissions

Your Slack API token needs the following scopes:

- `chat:write` - Send and edit messages
- `channels:read` - List public channels
- `groups:read` - List private channels
- `channels:history` - Read channel message history
- `groups:history` - Read private channel message history
- `im:history` - Read direct message history
- `users:read` - Access user information for unread counts
- `search:read` - Search messages (user token only, not supported with bot tokens)
- `reactions:write` - Add and remove reactions
- `pins:read` - List pinned items in a channel
- `pins:write` - Pin and unpin messages
- `files:write` - Upload files and snippets

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
