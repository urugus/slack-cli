import chalk from 'chalk';
import { extractErrorMessage } from './error-utils';

export type CommandAction<T = unknown> = (options: T) => Promise<void> | void;

export function wrapCommand<T = unknown>(action: CommandAction<T>): CommandAction<T> {
  return async (options: T) => {
    try {
      await action(options);
    } catch (error) {
      console.error(chalk.red('✗ Error:'), extractErrorMessage(error));

      if (process.env.NODE_ENV === 'development' && error instanceof Error) {
        console.error(chalk.gray(error.stack));
      }

      process.exit(1);
    }
  };
}

export async function getProfileName(
  configManager: { getCurrentProfile: () => Promise<string> },
  providedProfile?: string
): Promise<string> {
  return providedProfile || (await configManager.getCurrentProfile());
}
