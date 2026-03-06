import chalk from 'chalk';
import * as readline from 'readline';
import { Writable } from 'stream';
import { getProfileName } from '../utils/command-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utils/constants';
import { ProfileConfigManager } from '../utils/profile-config';

interface SetTokenOptions {
  token?: string;
  tokenStdin?: boolean;
  profile?: string;
}

async function readTokenFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

async function promptTokenInteractively(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'No token provided. Use --token-stdin, set SLACK_CLI_TOKEN, or run this command in an interactive terminal.'
    );
  }

  return await new Promise<string>((resolve, reject) => {
    let isMuted = false;
    const maskedOutput = new Writable({
      write(chunk, encoding, callback) {
        if (!isMuted) {
          if (typeof chunk === 'string') {
            process.stdout.write(chunk, encoding);
          } else {
            process.stdout.write(chunk);
          }
        }
        callback();
      },
    }) as Writable & { isTTY?: boolean };
    maskedOutput.isTTY = true;

    const rl = readline.createInterface({
      input: process.stdin,
      output: maskedOutput,
      terminal: true,
    });

    rl.question('Slack API token: ', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    isMuted = true;

    rl.on('SIGINT', () => {
      rl.close();
      reject(new Error('Token input cancelled'));
    });
  });
}

async function resolveTokenInput(options: SetTokenOptions): Promise<string> {
  if (options.token && options.tokenStdin) {
    throw new Error('Cannot use --token and --token-stdin together');
  }

  if (options.tokenStdin) {
    const token = await readTokenFromStdin();
    if (!token) {
      throw new Error('No token received from stdin');
    }
    return token;
  }

  if (options.token) {
    console.error(
      chalk.yellow(
        'Warning: --token may leak secrets via shell history/process list. Prefer --token-stdin or interactive input.'
      )
    );
    return options.token.trim();
  }

  const envToken = process.env.SLACK_CLI_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  const promptedToken = await promptTokenInteractively();
  if (!promptedToken) {
    throw new Error('Token cannot be empty');
  }
  return promptedToken;
}

export async function handleSetToken(options: SetTokenOptions): Promise<void> {
  const configManager = new ProfileConfigManager();
  const token = await resolveTokenInput(options);
  const profileName = await getProfileName(configManager, options.profile);
  await configManager.setToken(token, options.profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.TOKEN_SAVED(profileName)}`));
}

export async function handleGetConfig(options: { profile?: string }): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profileName = await getProfileName(configManager, options.profile);
  const currentConfig = await configManager.getConfig(options.profile);

  if (!currentConfig) {
    console.log(chalk.yellow(ERROR_MESSAGES.NO_CONFIG(profileName)));
    return;
  }

  console.log(chalk.bold(`Configuration for profile "${profileName}":`));
  console.log(`  Token: ${chalk.cyan(configManager.maskToken(currentConfig.token))}`);
  console.log(`  Updated: ${chalk.gray(currentConfig.updatedAt)}`);
}

export async function handleListProfiles(): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profiles = await configManager.listProfiles();
  const currentProfile = await configManager.getCurrentProfile();

  if (profiles.length === 0) {
    console.log(chalk.yellow(ERROR_MESSAGES.NO_PROFILES_FOUND));
    return;
  }

  console.log(chalk.bold('Available profiles:'));
  profiles.forEach((profile) => {
    const marker = profile.name === currentProfile ? '*' : ' ';
    const maskedToken = configManager.maskToken(profile.config.token);
    console.log(`  ${marker} ${chalk.cyan(profile.name)} (${maskedToken})`);
  });
}

export async function handleUseProfile(profile: string): Promise<void> {
  const configManager = new ProfileConfigManager();
  await configManager.useProfile(profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_SWITCHED(profile)}`));
}

export async function handleShowCurrentProfile(): Promise<void> {
  const configManager = new ProfileConfigManager();
  const currentProfile = await configManager.getCurrentProfile();
  console.log(chalk.bold(`Current profile: ${chalk.cyan(currentProfile)}`));
}

export async function handleClearConfig(options: { profile?: string }): Promise<void> {
  const configManager = new ProfileConfigManager();
  const profileName = await getProfileName(configManager, options.profile);
  await configManager.clearConfig(options.profile);
  console.log(chalk.green(`✓ ${SUCCESS_MESSAGES.PROFILE_CLEARED(profileName)}`));
}
