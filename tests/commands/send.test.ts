import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { sendCommand } from '../../src/commands/send';
import { SlackApiClient } from '../../src/utils/slack-api-client';
import { ProfileConfigManager } from '../../src/utils/profile-config';
import * as fs from 'fs/promises';

vi.mock('../../src/utils/slack-api-client');
vi.mock('../../src/utils/profile-config');
vi.mock('fs/promises');

describe('send command', () => {
  let program: Command;
  let mockSlackClient: SlackApiClient;
  let mockConfigManager: ProfileConfigManager;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfigManager = new ProfileConfigManager();
    vi.mocked(ProfileConfigManager).mockReturnValue(mockConfigManager);
    
    mockSlackClient = new SlackApiClient('test-token');
    vi.mocked(SlackApiClient).mockReturnValue(mockSlackClient);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    program = new Command();
    program.exitOverride();
    sendCommand(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send message with -m option', () => {
    it('should send a message to specified channel', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello, World!']);

      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith('general', 'Hello, World!');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Message sent successfully'));
    });

    it('should use specified profile', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'work-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello', '--profile', 'work']);

      expect(mockConfigManager.getConfig).toHaveBeenCalledWith('work');
      expect(SlackApiClient).toHaveBeenCalledWith('work-token');
    });
  });

  describe('send message with -f option', () => {
    it('should send message from file', async () => {
      const fileContent = 'Message from file\nLine 2';
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.sendMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-f', 'message.txt']);

      expect(fs.readFile).toHaveBeenCalledWith('message.txt', 'utf-8');
      expect(mockSlackClient.sendMessage).toHaveBeenCalledWith('general', fileContent);
    });
  });

  describe('validation', () => {
    it('should fail when no message or file is provided', async () => {
      await expect(
        program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general'])
      ).rejects.toThrow();
    });

    it('should fail when both message and file are provided', async () => {
      await expect(
        program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello', '-f', 'file.txt'])
      ).rejects.toThrow();
    });

    it('should fail when no channel is provided', async () => {
      await expect(
        program.parseAsync(['node', 'slack-cli', 'send', '-m', 'Hello'])
      ).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue(null);

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-m', 'Hello']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No configuration found'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle Slack API errors', async () => {
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });
      vi.mocked(mockSlackClient.sendMessage).mockRejectedValue(new Error('channel_not_found'));

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'nonexistent', '-m', 'Hello']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error sending message:'), expect.any(Error));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));
      vi.mocked(mockConfigManager.getConfig).mockResolvedValue({
        token: 'test-token',
        updatedAt: new Date().toISOString()
      });

      await program.parseAsync(['node', 'slack-cli', 'send', '-c', 'general', '-f', 'nonexistent.txt']);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading file'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});