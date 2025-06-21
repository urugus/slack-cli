import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { configCommand } from '../../src/commands/config';
import { ConfigManager } from '../../src/utils/config';
import type { Config } from '../../src/types/config';

vi.mock('../../src/utils/config');

describe('config command', () => {
  let program: Command;
  let mockConfigManager: ConfigManager;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfigManager = new ConfigManager();
    vi.mocked(ConfigManager).mockReturnValue(mockConfigManager);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    program = new Command();
    program.exitOverride();
    configCommand(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('config set', () => {
    it('should set token successfully', async () => {
      vi.mocked(mockConfigManager.setToken).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token', 'test-token-123']);

      expect(mockConfigManager.setToken).toHaveBeenCalledWith('test-token-123');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token saved successfully'));
    });

    it('should show error when token is not provided', async () => {
      await expect(
        program.parseAsync(['node', 'slack-cli', 'config', 'set'])
      ).rejects.toThrow();
    });

    it('should handle errors when saving token', async () => {
      vi.mocked(mockConfigManager.setToken).mockRejectedValue(new Error('Failed to save'));

      await program.parseAsync(['node', 'slack-cli', 'config', 'set', '--token', 'test-token-456']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error saving token'), expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config get', () => {
    it('should display config when it exists', async () => {
      const mockConfig: Config = {
        token: 'test-token-1234567890-abcdefghijklmnop',
        updatedAt: '2025-06-21T10:00:00.000Z'
      };

      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(mockConfigManager.maskToken).mockReturnValue('test-****-****-mnop');

      await program.parseAsync(['node', 'slack-cli', 'config', 'get']);

      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Current configuration:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Token: test-****-****-mnop'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Updated: 2025-06-21T10:00:00.000Z'));
    });

    it('should show message when no config exists', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'config', 'get']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No configuration found'));
    });

    it('should handle errors when reading config', async () => {
      vi.mocked(mockConfigManager.getConfig).mockRejectedValue(new Error('Failed to read'));

      await program.parseAsync(['node', 'slack-cli', 'config', 'get']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading configuration'), expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config clear', () => {
    it('should clear config successfully', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockResolvedValue(undefined);

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear']);

      expect(mockConfigManager.clearConfig).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration cleared successfully'));
    });

    it('should handle errors when clearing config', async () => {
      vi.mocked(mockConfigManager.clearConfig).mockRejectedValue(new Error('Failed to clear'));

      await program.parseAsync(['node', 'slack-cli', 'config', 'clear']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error clearing configuration'), expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('config (default)', () => {
    it('should show help when no subcommand is provided', async () => {
      const helpSpy = vi.fn();
      program.configureHelp({
        formatHelp: helpSpy
      });

      await expect(
        program.parseAsync(['node', 'slack-cli', 'config'])
      ).rejects.toThrow();
    });
  });
});