import { ApiError } from '../errors';
import { BaseSlackClient, SlackClientDependency } from './base-client';

export interface UserPresence {
  presence: string;
}

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
  constructor(dependency: SlackClientDependency) {
    super(dependency);
  }

  async listUsers(limit?: number): Promise<SlackUser[]> {
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      return [];
    }

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

      if (limit !== undefined && users.length >= limit) {
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

  async openDmChannel(userId: string): Promise<string> {
    const response = await this.client.conversations.open({
      users: userId,
    });
    return (response.channel as { id: string }).id;
  }

  async getPresence(userId: string): Promise<UserPresence> {
    const response = await this.client.users.getPresence({ user: userId });
    return { presence: response.presence as string };
  }

  async resolveUserIdByName(username: string): Promise<string> {
    const name = username.replace(/^@/, '');
    const nameLower = name.toLowerCase();

    let cursor: string | undefined;
    do {
      const response = await this.client.users.list({
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });

      const members = (response.members || []) as SlackUser[];
      for (const member of members) {
        if (member.name?.toLowerCase() === nameLower) {
          return member.id!;
        }
      }

      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    throw new ApiError(`User '${name}' not found`);
  }
}
