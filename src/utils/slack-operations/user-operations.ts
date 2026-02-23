import { BaseSlackClient } from './base-client';

export interface SlackUser {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
    title?: string;
    status_text?: string;
    status_emoji?: string;
  };
  tz?: string;
  tz_label?: string;
  is_admin?: boolean;
  is_bot?: boolean;
  deleted?: boolean;
}

export class UserOperations extends BaseSlackClient {
  constructor(token: string) {
    super(token);
  }

  async listUsers(limit?: number): Promise<SlackUser[]> {
    const users: SlackUser[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.users.list({
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });

      const members = (response.members || []) as SlackUser[];
      users.push(...members);

      cursor = response.response_metadata?.next_cursor || undefined;

      if (limit && users.length >= limit) {
        return users.slice(0, limit);
      }
    } while (cursor);

    return users;
  }

  async getUserInfo(userId: string): Promise<SlackUser> {
    const response = await this.client.users.info({ user: userId });
    return response.user as SlackUser;
  }

  async lookupByEmail(email: string): Promise<SlackUser> {
    const response = await this.client.users.lookupByEmail({ email });
    return response.user as SlackUser;
  }
}
