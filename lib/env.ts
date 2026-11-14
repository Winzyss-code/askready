import "server-only";
import { z } from "zod";

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((value) => {
    // Zod can run refinements even when the preceding URL check failed.
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.hostname !== "your-project.supabase.co" &&
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  }, "Use the project base URL without /rest/v1/ (HTTPS, or localhost for development)."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(20),
});

export function readSupabaseConfig() {
  // This module is server-only. Read deployment-time values rather than letting
  // Next inline NEXT_PUBLIC_* at build time (including in readiness checks).
  const result = supabaseSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Reflect.get(process.env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  });
  if (!result.success) {
    return {
      configured: false as const,
      missing: [...new Set(result.error.issues.map((issue) => String(issue.path[0])))],
    };
  }
  return { configured: true as const, ...result.data };
}
