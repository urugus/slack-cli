import { AbstractFormatter, createFormatterFactory, JsonFormatter } from './base-formatter';
import { sanitizeTerminalText } from '../terminal-sanitizer';

export interface MemberInfo {
  id: string;
  name?: string;
  realName?: string;
}

export interface MembersFormatterOptions {
  members: MemberInfo[];
}

class MembersTableFormatter extends AbstractFormatter<MembersFormatterOptions> {
  format({ members }: MembersFormatterOptions): void {
    console.log('ID                Name              Real Name');
    console.log('\u2500'.repeat(60));

    members.forEach((member) => {
      const id = sanitizeTerminalText(member.id || '').padEnd(17);
      const name = sanitizeTerminalText(member.name || '').padEnd(17);
      const realName = sanitizeTerminalText(member.realName || '');

      console.log(`${id} ${name} ${realName}`);
    });
  }
}

class MembersSimpleFormatter extends AbstractFormatter<MembersFormatterOptions> {
  format({ members }: MembersFormatterOptions): void {
    members.forEach((member) => {
      console.log(
        `${sanitizeTerminalText(member.id || '')}\t${sanitizeTerminalText(member.name || '')}\t${sanitizeTerminalText(member.realName || '')}`
      );
    });
  }
}

class MembersJsonFormatter extends JsonFormatter<MembersFormatterOptions> {
  protected transform({ members }: MembersFormatterOptions) {
    return members.map((member) => ({
      id: member.id,
      name: member.name || '',
      real_name: member.realName || '',
    }));
  }
}

const membersFormatterFactory = createFormatterFactory<MembersFormatterOptions>({
  table: new MembersTableFormatter(),
  simple: new MembersSimpleFormatter(),
  json: new MembersJsonFormatter(),
});

export function createMembersFormatter(format: string) {
  return membersFormatterFactory.create(format);
}
