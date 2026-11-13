import Link from "next/link";

import { AiGuideForm } from "@/components/AiGuideForm";
import { CelestialUniverseSection } from "@/components/CelestialUniverseSection";
import { Dashboard } from "@/components/Dashboard";
import { PageHeading } from "@/components/PageHeading";
import { PatternsNote } from "@/components/PatternsNote";
import { ReadingForm } from "@/components/ReadingForm";
import { SavedProfileNote } from "@/components/SavedProfileNote";
import { birthDefaults, getSavedBirth } from "@/lib/profile";

const MAX_PREFILL = 300;

/**
 * The app's home: the sky now, readings and the AI Guide. Signed in, it is
 * `/`; for anyone, it is `/guide`.
 *
 * A suggested question arrives as `?q=`. It only fills the box - nothing is
 * sent until the visitor presses Ask - and is clamped like any other input.
 */
export async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const prefill = (typeof q === "string" ? q : "").slice(0, MAX_PREFILL);
  const saved = await getSavedBirth();
  const defaults = birthDefaults(saved);

  return (
    <>
      <PageHeading title="Your celestial universe">
        Calculate your Vedic and Western charts, read the sky as it is now,
        and ask questions of a guide that interprets only what has been
        calculated. For reflection, not prediction.
      </PageHeading>

      <CelestialUniverseSection birth={saved.status === "saved" ? saved.birth : undefined} />

      <Link
        href="/chart"
        className="flex flex-col gap-1 panel p-5 transition hover:border-amber-400/50"
      >
        <span className="font-medium text-amber-300">
          Start with your birth chart →
        </span>
        <span className="text-sm text-slate-400">
          Vedic, Western, a side-by-side comparison, your Dasha timeline and
          the current transits.
        </span>
      </Link>

      <SavedProfileNote saved={saved} />

      {saved.status === "saved" && <Dashboard birth={saved.birth} />}

      <PatternsNote />

      <ReadingForm defaults={defaults} />

      <AiGuideForm key={prefill} defaults={defaults} initialQuestion={prefill} />
    </>
  );
}
