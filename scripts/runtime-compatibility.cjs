const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { test } = require('node:test');
const { LogLevel, WebClient, ErrorCode } = require('@slack/web-api');
const { FileOperations } = require('../dist/utils/slack-operations/file-operations');
const {
  MessageWriteOperations,
} = require('../dist/utils/slack-operations/message-write-operations');

test('compiled CLI starts and exposes its version and command help', () => {
  const cli = join(__dirname, '..', 'dist', 'index.js');
  const env = { ...process.env, CI: '1', SLACK_CLI_DISABLE_UPDATE_NOTIFIER: '1' };
  assert.equal(
    execFileSync(process.execPath, [cli, '--version'], { env, encoding: 'utf8' }).trim(),
    require('../package.json').version
  );
  for (const args of [[], ['send'], ['history'], ['file', 'upload']]) {
    const output = execFileSync(process.execPath, [cli, ...args, '--help'], {
      env,
      encoding: 'utf8',
    });
    assert.match(output, /Usage:/);
  }
});

test('real Slack SDK preserves message, error and file upload behavior', async (t) => {
  const requests = [];
  let responseBody = { ok: true, ts: '123.456', channel: 'C123' };
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    requests.push({ path: req.url, body, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/files.getUploadURLExternal') {
      res.end(JSON.stringify({ ok: true, file_id: 'F123', upload_url: `${baseUrl}upload` }));
    } else if (req.url === '/files.completeUploadExternal') {
      res.end(JSON.stringify({ ok: true, files: [{ id: 'F123', name: 'test.txt' }] }));
    } else if (req.url === '/upload') {
      res.end('OK');
    } else {
      res.end(JSON.stringify(responseBody));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const client = new WebClient('synthetic-test-token', {
    slackApiUrl: baseUrl,
    retryConfig: { retries: 0 },
    logLevel: LogLevel.ERROR,
  });
  const messages = new MessageWriteOperations(client);
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*hello*' } }];
  const result = await messages.sendMessage('C123', 'hello', '123.000', blocks);
  assert.equal(result.ts, '123.456');
  const request = requests[0];
  assert.equal(request.path, '/chat.postMessage');
  assert.equal(request.headers.authorization, 'Bearer synthetic-test-token');
  const fields = new URLSearchParams(request.body);
  assert.equal(fields.get('channel'), 'C123');
  assert.equal(fields.get('thread_ts'), '123.000');
  assert.deepEqual(JSON.parse(fields.get('blocks')), blocks);

  responseBody = { ok: false, error: 'channel_not_found' };
  await assert.rejects(messages.sendMessage('C123', 'hello'), (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.code, ErrorCode.PlatformError);
    assert.match(error.message, /channel_not_found/);
    return true;
  });

  const files = new FileOperations(client, { resolveChannelId: async () => 'C123' });
  await files.uploadFile({ channel: 'C123', content: 'file contents', filename: 'test.txt' });
  assert.match(
    requests.find((r) => r.path === '/upload').body,
    /(?:^|\r\n)file contents(?:\r\n|$)/
  );
  const completion = new URLSearchParams(
    requests.find((r) => r.path === '/files.completeUploadExternal').body
  );
  assert.equal(completion.get('channel_id'), 'C123');
  assert.equal(JSON.parse(completion.get('files'))[0].id, 'F123');
});
