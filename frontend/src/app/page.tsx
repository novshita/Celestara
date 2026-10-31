import Link from "next/link";

import { AiGuideForm } from "@/components/AiGuideForm";
import { PageHeading } from "@/components/PageHeading";
import { ReadingForm } from "@/components/ReadingForm";

export default function Home() {
  return (
    <>
      <PageHeading title="Your celestial universe">
        Calculate your Vedic and Western charts, read the sky as it is now,
        and ask questions of a guide that interprets only what has been
        calculated. For reflection, not prediction.
      </PageHeading>

      <Link
        href="/chart"
        className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-5 transition hover:border-amber-400/50"
      >
        <span className="font-medium text-amber-300">
          Start with your birth chart →
        </span>
        <span className="text-sm text-slate-400">
          Vedic, Western, a side-by-side comparison, your Dasha timeline and
          the current transits.
        </span>
      </Link>

      <ReadingForm />

      <AiGuideForm />
    </>
  );
}
