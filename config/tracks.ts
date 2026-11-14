export const tracks = [
  { id: "ask", title: "Ask for more", description: "Make the case for what you’ve earned, and don’t leave without a next step." },
  { id: "ground", title: "Hold your ground", description: "Say no, set boundaries and give honest feedback without burning the relationship." },
] as const;
export type TrackId = (typeof tracks)[number]["id"];
