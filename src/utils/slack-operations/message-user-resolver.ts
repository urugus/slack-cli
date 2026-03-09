import { BaseSlackClient, SlackClientDependency } from './base-client';

export class MessageUserResolver extends BaseSlackClient {
  constructor(dependency: SlackClientDependency) {
    super(dependency);
  }

  async fetchUserInfo(userIds: string[]): Promise<Map<string, string>> {
    const users = new Map<string, string>();

    for (const userId of userIds) {
      try {
        const userInfo = await this.client.users.info({ user: userId });
        if (userInfo.user?.name) {
          users.set(userId, userInfo.user.name);
        }
      } catch {
        users.set(userId, userId);
      }
    }

    return users;
  }
}
