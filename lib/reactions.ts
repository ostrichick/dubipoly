/** Quick reactions shared by the picker UI and the server allowlist. */
export const REACTIONS = [
  { emoji: '😍', label: 'Love' },
  { emoji: '😭', label: 'Tears' },
  { emoji: '😱', label: 'Shock' },
  { emoji: '💪', label: 'Cheer' },
] as const;

export function isReactionEmoji(value: unknown): value is string {
  return REACTIONS.some((reaction) => reaction.emoji === value);
}
