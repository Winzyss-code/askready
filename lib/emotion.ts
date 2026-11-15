// The counterpart's mood for one reply. The model chooses it with a leading tag such as "[skeptical]";
// the app strips the tag before the reply is saved, shown or spoken.
export const emotions = ["neutral", "skeptical", "warm", "impatient", "impressed"] as const;
export type Emotion = (typeof emotions)[number];

export function isEmotion(value: unknown): value is Emotion {
  return typeof value === "string" && (emotions as readonly string[]).includes(value);
}

// Longest text we wait on for a closing bracket before deciding the reply has no tag.
const TAG_LIMIT = 24;
const anyTag = new RegExp(`\\s*\\[(?:${emotions.join("|")})\\]\\s*`, "gi");

/**
 * Reads the leading mood tag from a reply that may arrive in pieces. `push` returns the text that is safe to
 * show or speak so far: nothing until the tag is resolved, then everything after it. The emotion is known as
 * soon as the tag closes, before any of the reply is released. A missing, unknown or disallowed tag is neutral,
 * and any leading bracketed tag is removed either way, so a label never reaches the transcript or the voice.
 */
export function createEmotionReader(allowed: readonly Emotion[] = emotions) {
  let pending = "";
  let settled = false;
  // Until the first word is out, whitespace is dropped, even when the tag and the space after it arrive separately.
  let started = false;
  let emotion: Emotion = "neutral";
  const release = (rest: string) => { settled = true; pending = ""; const text = rest.trimStart(); if (text) started = true; return text; };
  return {
    push(chunk: string): string {
      if (settled && started) return chunk;
      if (settled) { const text = chunk.trimStart(); if (text) started = true; return text; }
      pending += chunk;
      const start = pending.trimStart();
      if (!start) return "";
      if (!start.startsWith("[")) return release(start);
      const close = start.indexOf("]");
      if (close === -1) return start.length > TAG_LIMIT ? release(start) : "";
      const tag = start.slice(1, close).trim().toLowerCase();
      if (isEmotion(tag) && allowed.includes(tag)) emotion = tag;
      return release(start.slice(close + 1));
    },
    /** Call once the reply is complete: returns whatever was still held back. */
    end(): string {
      if (settled) return "";
      const rest = pending.trimStart();
      settled = true;
      pending = "";
      return /^\[[^\]]*$/.test(rest) && rest.length <= TAG_LIMIT ? "" : rest;
    },
    get emotion() { return emotion; },
  };
}

/** Removes any mood tag that turns up later in a reply. */
export function stripTags(text: string) { return text.replace(anyTag, " ").replace(/\s{2,}/g, " ").trim(); }

/** A whole reply: its emotion, and its text with the tag (and any stray mood tag later on) removed. */
export function parseEmotion(reply: string, allowed: readonly Emotion[] = emotions) {
  const reader = createEmotionReader(allowed);
  const text = stripTags(reader.push(reply) + reader.end());
  return { emotion: reader.emotion, text };
}
