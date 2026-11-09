import Link from "next/link";

import { getPatterns } from "@/lib/backend";
import { getSessionToken } from "@/lib/session";

/**
 * Product spec §20: a recurring theme in the signed-in user's own saved
 * questions. Shows nothing for a visitor, when the user has turned it off,
 * when no topic has come up repeatedly, or when the lookup fails - it is a
 * quiet aside, never something the page waits on or reports an error for.
 */
export async function PatternsNote() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  let patterns;
  try {
    const response = await getPatterns(token);
    if (!response.enabled) {
      return null;
    }
    patterns = response.patterns;
  } catch (error) {
    console.error("could not load themes", error);
    return null;
  }
  if (patterns.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="A theme in your questions"
      className="flex flex-col gap-1 panel p-5"
    >
      {patterns.map((pattern) => (
        <p key={pattern.topic} className="text-sm text-slate-300">
          {pattern.note}
        </p>
      ))}
      <p className="text-xs text-slate-400">
        You can turn this off in your{" "}
        <Link
          href="/profile"
          className="underline underline-offset-2 hover:text-slate-200"
        >
          preferences
        </Link>
        .
      </p>
    </aside>
  );
}
