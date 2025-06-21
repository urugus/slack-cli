import chalk from 'chalk';

export type CommandAction<T = unknown> = (options: T) => Promise<void> | void;

export function wrapCommand<T = unknown>(action: CommandAction<T>): CommandAction<T> {
  return async (options: T) => {
    try {
      await action(options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red('✗ Error:'), errorMessage);

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
