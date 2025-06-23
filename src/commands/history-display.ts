import chalk from 'chalk';
import { Message } from '../utils/slack-api-client';
import { formatSlackTimestamp } from '../utils/date-utils';
import { formatMessageWithMentions } from '../utils/format-utils';

export function displayHistoryResults(
  messages: Message[],
  users: Map<string, string>,
  channelName: string
): void {
  if (messages.length === 0) {
    console.log(chalk.yellow('No messages found in the specified channel.'));
    return;
  }

  console.log(chalk.bold(`\nMessage History for #${channelName}:\n`));

  // Display messages in reverse order (oldest first)
  messages.reverse().forEach((message: Message) => {
    const timestamp = formatSlackTimestamp(message.ts);
    let author = 'Unknown';

    if (message.user && users.has(message.user)) {
      author = users.get(message.user)!;
    } else if (message.bot_id) {
      author = 'Bot';
    }

    console.log(chalk.gray(`[${timestamp}]`) + ' ' + chalk.cyan(author));
    if (message.text) {
      const formattedText = formatMessageWithMentions(message.text, users);
      console.log(formattedText);
    }
    console.log(''); // Empty line between messages
  });

  console.log(chalk.green(`✓ Displayed ${messages.length} message(s)`));
}
