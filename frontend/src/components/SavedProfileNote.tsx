import Link from "next/link";

import type { SavedBirth } from "@/lib/profile";

/** Tells a logged-in visitor where the pre-filled birth data came from, or
 * how to get it. Says nothing to anyone else. */
export function SavedProfileNote({ saved }: { saved: SavedBirth }) {
  if (saved.status === "saved") {
    return (
      <p className="text-sm text-slate-500">
        Birth details are filled in from your saved profile. You can change
        them for a one-off, or{" "}
        <Link href="/profile" className="text-amber-300 hover:underline">
          update the profile
        </Link>
        .
      </p>
    );
  }

  if (saved.status === "none") {
    return (
      <p className="text-sm text-slate-500">
        <Link href="/profile" className="text-amber-300 hover:underline">
          Save a birth profile
        </Link>{" "}
        and these forms will fill themselves in.
      </p>
    );
  }

  return null;
}
