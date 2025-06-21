import { vi } from 'vitest';
import { Command } from 'commander';

export interface MockConsole {
  logSpy: any;
  errorSpy: any;
  exitSpy: any;
}

export function setupMockConsole(): MockConsole {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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