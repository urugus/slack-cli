import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { ConfigurationError } from './errors';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectPort: number;
}

export interface OAuthTokenResponse {
  ok: boolean;
  access_token?: string;
  authed_user?: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  team?: {
    id: string;
    name: string;
  };
  error?: string;
}

const DEFAULT_SCOPES = [
  'chat:write',
  'channels:read',
  'channels:write',
  'channels:history',
  'groups:read',
  'groups:write',
  'groups:history',
  'im:history',
  'im:write',
  'mpim:history',
  'users:read',
  'users:read.email',
  'search:read',
  'reactions:write',
  'pins:read',
  'pins:write',
  'files:read',
  'files:write',
  'canvases:read',
];

const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  clientId: '',
  clientSecret: '',
  scopes: DEFAULT_SCOPES,
  redirectPort: 8435,
};

/**
 * Slack OAuth 2.0 認証フローを管理するサービス
 *
 * ローカルHTTPサーバーを起動し、OAuthコールバックを受け取って
 * ユーザートークンを取得する。
 */
export class OAuthService {
  private config: OAuthConfig;
  private state: string;

  constructor(config: Partial<OAuthConfig> = {}) {
    this.config = { ...DEFAULT_OAUTH_CONFIG, ...config };
    this.state = crypto.randomBytes(16).toString('hex');
  }

  /**
   * OAuth認証URL（ユーザートークン用）を生成する
   */
  getAuthorizationUrl(): string {
    if (!this.config.clientId) {
      throw new ConfigurationError(
        'Client ID が設定されていません。環境変数 SLACK_CLI_CLIENT_ID を設定するか、--client-id オプションを指定してください。'
      );
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      user_scope: this.config.scopes.join(','),
      redirect_uri: this.getRedirectUri(),
      state: this.state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * ローカルサーバーを起動してOAuthコールバックを待ち受け、
   * 認可コードを受け取ってトークンを交換する
   */
  async waitForCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (!req.url) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><h1>不正なリクエストです</h1></body></html>');
            return;
          }

          const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.config.redirectPort}`);

          if (parsedUrl.pathname !== '/callback') {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><h1>Not Found</h1></body></html>');
            return;
          }

          const code = parsedUrl.searchParams.get('code');
          const state = parsedUrl.searchParams.get('state');
          const oauthError = parsedUrl.searchParams.get('error');

          if (oauthError) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(
              `<html><body><h1>認証エラー</h1><p>${oauthError}</p><p>このウィンドウを閉じてください。</p></body></html>`
            );
            server.close();
            reject(new ConfigurationError(`OAuth認証エラー: ${oauthError}`));
            return;
          }

          if (state !== this.state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(
              '<html><body><h1>認証エラー</h1><p>state パラメータが一致しません。</p><p>このウィンドウを閉じてください。</p></body></html>'
            );
            server.close();
            reject(new ConfigurationError('OAuth state パラメータが一致しません'));
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(
              '<html><body><h1>認証エラー</h1><p>認可コードが取得できませんでした。</p><p>このウィンドウを閉じてください。</p></body></html>'
            );
            server.close();
            reject(new ConfigurationError('認可コードが取得できませんでした'));
            return;
          }

          // 認可コードをトークンに交換
          const token = await this.exchangeCodeForToken(code);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<html><body><h1>認証成功！</h1><p>トークンが取得されました。このウィンドウを閉じてください。</p></body></html>'
          );
          server.close();
          resolve(token);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<html><body><h1>エラー</h1><p>トークンの取得に失敗しました。</p><p>このウィンドウを閉じてください。</p></body></html>'
          );
          server.close();
          reject(err);
        }
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(
            new ConfigurationError(
              `ポート ${this.config.redirectPort} は使用中です。--port オプションで別のポートを指定してください。`
            )
          );
        } else {
          reject(new ConfigurationError(`サーバーの起動に失敗しました: ${err.message}`));
        }
      });

      server.listen(this.config.redirectPort, '127.0.0.1', () => {
        // サーバー起動完了
      });

      // 3分でタイムアウト
      setTimeout(() => {
        server.close();
        reject(new ConfigurationError('OAuth認証がタイムアウトしました（3分）'));
      }, 180000);
    });
  }

  /**
   * 認可コードをアクセストークンに交換する
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const postData = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.getRedirectUri(),
    }).toString();

    return new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'slack.com',
          path: '/api/oauth.v2.access',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            try {
              const response = JSON.parse(data) as OAuthTokenResponse;

              if (!response.ok) {
                reject(
                  new ConfigurationError(
                    `トークン取得エラー: ${response.error || 'unknown error'}`
                  )
                );
                return;
              }

              // ユーザートークンを取得
              const token = response.authed_user?.access_token;
              if (!token) {
                reject(new ConfigurationError('ユーザートークンが取得できませんでした'));
                return;
              }

              resolve(token);
            } catch {
              reject(new ConfigurationError('トークンレスポンスの解析に失敗しました'));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new ConfigurationError(`トークン交換リクエストに失敗しました: ${err.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  private getRedirectUri(): string {
    return `http://localhost:${this.config.redirectPort}/callback`;
  }
}
