import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebClient } from '@slack/web-api';
import { sendCommand } from './send';

vi.mock('@slack/web-api');

describe('sendCommand', () => {
  let mockWebClient: any;
  let mockChatPostMessage: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockChatPostMessage = vi.fn();
    mockWebClient = {
      chat: {
        postMessage: mockChatPostMessage
      }
    };
    
    (WebClient as any).mockImplementation(() => mockWebClient);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    vi.clearAllMocks();
  });

  it('should send a message to a channel', async () => {
    const options = {
      channel: 'general',
      message: 'Hello, World!',
      token: 'test-token'
    };

    mockChatPostMessage.mockResolvedValue({
      ok: true,
      ts: '1234567890.123456'
    });

    await sendCommand(options);

    expect(WebClient).toHaveBeenCalledWith({ token: 'test-token' });
    expect(mockChatPostMessage).toHaveBeenCalledWith({
      channel: 'general',
      text: 'Hello, World!',
      mrkdwn: false
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Message sent successfully'));
  });

  it('should use environment token when no token provided', async () => {
    process.env.SLACK_API_TOKEN = 'env-token';
    
    const options = {
      channel: 'general',
      message: 'Hello from env!'
    };

    mockChatPostMessage.mockResolvedValue({
      ok: true,
      ts: '1234567890.123456'
    });

    await sendCommand(options);

    expect(WebClient).toHaveBeenCalledWith({ token: 'env-token' });
  });

  it('should handle markdown format', async () => {
    const options = {
      channel: 'general',
      message: '*Bold* and _italic_',
      token: 'test-token',
      format: 'markdown'
    };

    mockChatPostMessage.mockResolvedValue({
      ok: true,
      ts: '1234567890.123456'
    });

    await sendCommand(options);

    expect(mockChatPostMessage).toHaveBeenCalledWith({
      channel: 'general',
      text: '*Bold* and _italic_',
      mrkdwn: true
    });
  });

  it('should read message from file', async () => {
    const fs = await import('fs/promises');
    vi.spyOn(fs, 'readFile').mockResolvedValue('File content');

    const options = {
      channel: 'general',
      file: 'message.txt',
      token: 'test-token'
    };

    mockChatPostMessage.mockResolvedValue({
      ok: true,
      ts: '1234567890.123456'
    });

    await sendCommand(options);

    expect(fs.readFile).toHaveBeenCalledWith('message.txt', 'utf-8');
    expect(mockChatPostMessage).toHaveBeenCalledWith({
      channel: 'general',
      text: 'File content',
      mrkdwn: false
    });
  });

  it('should handle missing token', async () => {
    delete process.env.SLACK_API_TOKEN;
    
    const options = {
      channel: 'general',
      message: 'Hello!'
    };

    await sendCommand(options);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No Slack API token provided'));
    expect(mockChatPostMessage).not.toHaveBeenCalled();
  });

  it('should handle missing message and file', async () => {
    const options = {
      channel: 'general',
      token: 'test-token'
    };

    await sendCommand(options);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No message or file provided'));
    expect(mockChatPostMessage).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const options = {
      channel: 'general',
      message: 'Hello!',
      token: 'test-token'
    };

    mockChatPostMessage.mockRejectedValue(new Error('API Error'));

    await sendCommand(options);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error sending message'));
  });
});