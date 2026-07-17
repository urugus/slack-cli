import { WebClient } from '@slack/web-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelResolver } from '../../../src/utils/channel-resolver';
import { AssistantOperations } from '../../../src/utils/slack-operations/assistant-operations';

vi.mock('@slack/web-api');
vi.mock('../../../src/utils/channel-resolver');

describe('AssistantOperations', () => {
  type MockClient = {
    assistant?: {
      threads?: {
        setStatus?: ReturnType<typeof vi.fn>;
      };
    };
    apiCall: ReturnType<typeof vi.fn>;
  };

  let assistantOps: AssistantOperations;
  let mockClient: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      assistant: {
        threads: {
          setStatus: vi.fn(),
        },
      },
      apiCall: vi.fn(),
    };
    vi.mocked(WebClient).mockImplementation(function () {
      return mockClient;
    } as never);
    vi.mocked(channelResolver.resolveChannelId).mockResolvedValue('C1234567890');
    assistantOps = new AssistantOperations('test-token');
  });

  it('should call assistant.threads.setStatus with resolved channel ID', async () => {
    vi.mocked(mockClient.assistant?.threads?.setStatus).mockResolvedValue({ ok: true });

    await assistantOps.setThreadStatus({
      channel: 'general',
      threadTs: '1234567890.123456',
      status: 'Working on it',
      loadingMessages: ['Checking context', 'Calling tools'],
    });

    expect(channelResolver.resolveChannelId).toHaveBeenCalledWith('general', expect.any(Function));
    expect(mockClient.assistant?.threads?.setStatus).toHaveBeenCalledWith({
      channel_id: 'C1234567890',
      thread_ts: '1234567890.123456',
      status: 'Working on it',
      loading_messages: ['Checking context', 'Calling tools'],
    });
  });

  it('should fall back to apiCall when typed helper is unavailable', async () => {
    mockClient.assistant = undefined;
    vi.mocked(mockClient.apiCall).mockResolvedValue({ ok: true });

    await assistantOps.setThreadStatus({
      channel: 'general',
      threadTs: '1234567890.123456',
      status: 'Thinking',
    });

    expect(mockClient.apiCall).toHaveBeenCalledWith('assistant.threads.setStatus', {
      channel_id: 'C1234567890',
      thread_ts: '1234567890.123456',
      status: 'Thinking',
    });
  });

  it('should clear status by sending an empty status string', async () => {
    vi.mocked(mockClient.assistant?.threads?.setStatus).mockResolvedValue({ ok: true });

    await assistantOps.clearThreadStatus('general', '1234567890.123456');

    expect(mockClient.assistant?.threads?.setStatus).toHaveBeenCalledWith({
      channel_id: 'C1234567890',
      thread_ts: '1234567890.123456',
      status: '',
    });
  });
});
