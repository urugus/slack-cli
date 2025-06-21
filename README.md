# Slack CLI

A command-line tool for sending messages to Slack using the Slack API.

## Installation

```bash
npm install -g slack-cli
```

## Configuration

You need to configure your Slack API token on first use:

```bash
slack-cli config --token YOUR_SLACK_API_TOKEN
```

## Usage

### Sending Messages

```bash
# Basic usage
slack-cli send -c channel-name -m "Your message here"

# Using channel ID
slack-cli send -c C1234567890 -m "Your message here"

# Multi-line message
slack-cli send -c general -m "Line 1\nLine 2\nLine 3"

# Send message from file
slack-cli send -c random -f message.txt
```

### List Channels

```bash
# List all channels
slack-cli channels

# List public channels only
slack-cli channels --public

# List private channels only
slack-cli channels --private
```

### View Message History

```bash
# Get latest 10 messages
slack-cli history -c general

# Specify number of messages
slack-cli history -c general -n 20

# Get messages since specific date
slack-cli history -c general --since "2024-01-01 00:00:00"
```

### Get Unread Messages

```bash
# Get all unread messages across all channels
slack-cli unread

# Get unread messages from specific channel
slack-cli unread -c general

# Get unread messages with channel names
slack-cli unread --show-channel

# Mark messages as read after fetching
slack-cli unread --mark-read

# Get unread messages from multiple channels
slack-cli unread -c general,random,development
```

### Other Commands

```bash
# Show help
slack-cli --help

# Show version
slack-cli --version

# Show current configuration
slack-cli config --show

# Update token
slack-cli config --token NEW_TOKEN
```

## Options

| Option | Short | Description |
|--------|-------|-------------|
| --channel | -c | Target channel name or ID |
| --message | -m | Message to send |
| --file | -f | File containing message content |
| --token | -t | Slack API token (temporary override) |
| --format | | Message format (text/markdown) |
| --verbose | -v | Show verbose output |
| --show-channel | | Display channel name with unread messages |
| --mark-read | | Mark messages as read after fetching |

## Environment Variables

- `SLACK_API_TOKEN`: Default API token
- `SLACK_DEFAULT_CHANNEL`: Default target channel

## Required Permissions

Your Slack API token needs the following scopes:

- `chat:write` - Send messages
- `channels:read` - List public channels
- `groups:read` - List private channels
- `channels:history` - Read channel message history
- `groups:history` - Read private channel message history
- `im:history` - Read direct message history
- `users:read` - Access user information for unread counts

## License

MIT