import { Command } from 'commander';
import { vi } from 'vitest';

export interface MockConsole {
  logSpy: any;
  errorSpy: any;
  exitSpy: any;
}

export function setupMockConsole(): MockConsole {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  return { logSpy, errorSpy, exitSpy };
}

export function createTestProgram(): Command {
  const program = new Command();
  program.exitOverride((err) => {
    throw new Error('process.exit');
  });
  return program;
}

export function restoreMocks(): void {
  vi.restoreAllMocks();
}
