import * as https from 'https';
import { describe, expect, it } from 'vitest';
import { OAuthService } from '../../src/utils/oauth-service';

function makeRequest(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        rejectUnauthorized: false, // 自己署名証明書を許可
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('OAuthService', () => {
  describe('constructor', () => {
    it('デフォルト設定で初期化できる', () => {
      const service = new OAuthService({ clientId: 'test-id', clientSecret: 'test-secret' });
      expect(service).toBeInstanceOf(OAuthService);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('正しいOAuth認証URLを生成する', () => {
      const service = new OAuthService({
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectPort: 8435,
      });
      const authUrl = service.getAuthorizationUrl();

      expect(authUrl).toContain('https://slack.com/oauth/v2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('user_scope=');
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Flocalhost%3A8435%2Fcallback');
      expect(authUrl).toContain('state=');
    });

    it('Client IDが未設定の場合エラーをスローする', () => {
      const service = new OAuthService({ clientId: '', clientSecret: 'test-secret' });
      expect(() => service.getAuthorizationUrl()).toThrow('Client ID');
    });

    it('カスタムスコープを使用できる', () => {
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        scopes: ['chat:write', 'channels:read'],
      });
      const authUrl = service.getAuthorizationUrl();

      expect(authUrl).toContain('user_scope=chat%3Awrite%2Cchannels%3Aread');
    });

    it('カスタムポートを使用できる', () => {
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectPort: 9999,
      });
      const authUrl = service.getAuthorizationUrl();

      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Flocalhost%3A9999%2Fcallback');
    });

    it('リダイレクトURIがhttpsスキームである', () => {
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      const authUrl = service.getAuthorizationUrl();
      const url = new URL(authUrl);
      const redirectUri = url.searchParams.get('redirect_uri');

      expect(redirectUri).toMatch(/^https:\/\//);
    });
  });

  describe('waitForCallback', () => {
    it('stateが一致しないリクエストを拒否する', async () => {
      const port = 18436;
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectPort: port,
      });

      const callbackPromise = service.waitForCallback();
      const rejectPromise = expect(callbackPromise).rejects.toThrow('state');

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      const statusCode = await makeRequest(port, '/callback?code=test-code&state=wrong-state');
      expect(statusCode).toBe(400);

      await rejectPromise;
    });

    it('認可コードがないリクエストを拒否する', async () => {
      const port = 18437;
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectPort: port,
      });

      const authUrl = service.getAuthorizationUrl();
      const urlObj = new URL(authUrl);
      const state = urlObj.searchParams.get('state');

      const callbackPromise = service.waitForCallback();
      const rejectPromise = expect(callbackPromise).rejects.toThrow('認可コード');

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      const statusCode = await makeRequest(port, `/callback?state=${state}`);
      expect(statusCode).toBe(400);

      await rejectPromise;
    });

    it('OAuthエラーを正しくハンドリングする', async () => {
      const port = 18438;
      const service = new OAuthService({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        redirectPort: port,
      });

      const callbackPromise = service.waitForCallback();
      const rejectPromise = expect(callbackPromise).rejects.toThrow('access_denied');

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      const statusCode = await makeRequest(port, '/callback?error=access_denied');
      expect(statusCode).toBe(400);

      await rejectPromise;
    });
  });
});
