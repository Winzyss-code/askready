// The counterpart's mood for one reply. The model chooses it with a leading tag such as "[skeptical]";
// the app strips the tag before the reply is saved, shown or spoken.
export const emotions = ["neutral", "skeptical", "warm", "impatient", "impressed"] as const;
export type Emotion = (typeof emotions)[number];

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (emotions as readonly string[]).includes(value);
}
