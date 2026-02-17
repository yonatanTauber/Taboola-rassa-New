export const PATIENT_AVATARS = [
  { key: "calm-man", emoji: "🧑‍⚕️" },
  { key: "calm-woman", emoji: "👩" },
  { key: "thoughtful-man", emoji: "👨" },
  { key: "thoughtful-woman", emoji: "👩‍🦱" },
  { key: "young-man", emoji: "👦" },
  { key: "young-woman", emoji: "👧" },
  { key: "older-man", emoji: "👴" },
  { key: "older-woman", emoji: "👵" },
  { key: "neutral-1", emoji: "🧑" },
  { key: "neutral-2", emoji: "🧑‍🦰" },
] as const;

export function avatarEmoji(key: string) {
  return PATIENT_AVATARS.find((item) => item.key === key)?.emoji ?? "🧑";
}
