import { BaseSlackClient, SlackClientDependency } from './base-client';

export const MAX_USER_INFO_LOOKUPS = 100;

/** @internal Internal helper for resolving user names in message flows. */
export class MessageUserResolver extends BaseSlackClient {
  private failedUserLookups = new Set<string>();

  constructor(dependency: SlackClientDependency) {
    super(dependency);
  }

  async fetchUserInfo(userIds: string[]): Promise<Map<string, string>> {
    const users = new Map<string, string>();
    const uniqueUserIds = Array.from(new Set(userIds));
    let lookupCount = 0;

    for (const userId of uniqueUserIds) {
      if (this.failedUserLookups.has(userId)) {
        users.set(userId, userId);
        continue;
      }

      if (lookupCount >= MAX_USER_INFO_LOOKUPS) {
        users.set(userId, userId);
        continue;
      }

      lookupCount += 1;
      try {
        const userInfo = await this.client.users.info({ user: userId });
        if (userInfo.user?.name) {
          users.set(userId, userInfo.user.name);
        } else {
          this.failedUserLookups.add(userId);
          users.set(userId, userId);
        }
      } catch {
        this.failedUserLookups.add(userId);
        users.set(userId, userId);
      }
    }

    return users;
  }
}
