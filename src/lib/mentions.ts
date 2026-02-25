import type { TeamMember } from './crmData';

export interface MentionTarget {
  id: string;
  handle: string;
  name: string;
  email: string;
}

function sanitizePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getTeamHandle(member: Pick<TeamMember, 'name' | 'email'>): string {
  const [firstName = '', lastName = ''] = member.name.trim().split(/\s+/);
  const initial = sanitizePart(firstName).slice(0, 1);
  const last = sanitizePart(lastName);

  if (initial && last) {
    return `${initial}${last}`;
  }

  const emailLocal = sanitizePart(member.email.split('@')[0] || '');
  if (emailLocal) return emailLocal;

  const fallback = sanitizePart(member.name);
  return fallback || 'team';
}

export function getMentionTargets(team: TeamMember[]): MentionTarget[] {
  return team
    .map((member) => ({
      id: member.id,
      handle: getTeamHandle(member),
      name: member.name,
      email: member.email,
    }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

export function extractMentionHandles(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export function findActiveMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const atIndex = before.lastIndexOf('@');
  if (atIndex === -1) return null;

  const between = before.slice(atIndex + 1);
  if (between.includes(' ') || between.includes('\n') || between.includes('\t')) return null;
  if (between.length > 32) return null;

  return { start: atIndex, query: between.toLowerCase() };
}

export function applyMention(text: string, start: number, caret: number, handle: string): { text: string; caret: number } {
  const prefix = text.slice(0, start);
  const suffix = text.slice(caret);
  const mention = `@${handle}`;
  const space = suffix.startsWith(' ') || suffix.length === 0 ? '' : ' ';
  const next = `${prefix}${mention}${space}${suffix}`;
  const nextCaret = (prefix + mention + space).length;
  return { text: next, caret: nextCaret };
}

export function getMentionSuggestions(targets: MentionTarget[], query: string): MentionTarget[] {
  const normalized = query.toLowerCase();
  return targets
    .filter((target) => {
      if (!normalized) return true;
      return (
        target.handle.includes(normalized) ||
        target.name.toLowerCase().includes(normalized) ||
        target.email.toLowerCase().includes(normalized)
      );
    })
    .slice(0, 6);
}

export function validateMentions(text: string, targets: MentionTarget[]): { valid: string[]; invalid: string[] } {
  const handles = extractMentionHandles(text);
  const known = new Set(targets.map((t) => t.handle.toLowerCase()));

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const handle of handles) {
    if (known.has(handle)) valid.push(handle);
    else invalid.push(handle);
  }

  return { valid, invalid };
}
