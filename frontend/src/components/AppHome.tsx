import { DesignShell } from "@/components/chart/DesignShell";
import { AiGuideForm } from "@/components/AiGuideForm";
import { HomeHub } from "@/components/home/HomeHub";
import { PatternsNote } from "@/components/PatternsNote";
import { ReadingForm } from "@/components/ReadingForm";
import { getDashboard, stripFrom, type ProfileStrip } from "@/lib/dashboard";
import { birthDefaults, getSavedBirth } from "@/lib/profile";
import { loadSky } from "@/lib/sky";
import type { ReadingFocus, ReadingKind } from "@/lib/types";

const MAX_PREFILL = 300;

const KINDS: readonly ReadingKind[] = ["daily", "weekly", "monthly", "birth_chart"];
const FOCI: readonly ReadingFocus[] = ["career", "love", "relationships", "growth"];
const DEPTHS = ["beginner", "technical"] as const;

type Search = { [key: string]: string | string[] | undefined };

const one = (value: string | string[] | undefined): string => (typeof value === "string" ? value : "");

/**
 * The app's home: the hub (the sky now and three ways in) and, below it, the reading and Guide
 * forms the hub's doors lead to. Signed in, it is `/`; for anyone, it is `/guide`.
 *
 * The doors only choose: `?period=`, `?focus=`, `?depth=` and `?q=` pre-fill the forms below,
 * and nothing is sent until the visitor presses a form's own button. Each is checked against
 * the values the forms actually offer, so a mangled address simply pre-fills nothing.
 */
export async function AppHome({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const question = one(params.q).slice(0, MAX_PREFILL);
  const period = KINDS.find((k) => k === one(params.period));
  const focus = FOCI.find((f) => f === one(params.focus));
  const depth = DEPTHS.find((d) => d === one(params.depth));

  const saved = await getSavedBirth();
  const defaults = birthDefaults(saved);

  const [sky, dashboard] = await Promise.all([
    loadSky(),
    saved.status === "saved" ? getDashboard(saved.birth) : Promise.resolve(null),
  ]);
  const strip: ProfileStrip =
    saved.status === "saved"
      ? { status: "saved", dashboard: dashboard ? stripFrom(dashboard) : null }
      : { status: saved.status };

  const signedIn = saved.status === "saved" || saved.status === "none" || saved.status === "unavailable";

  return (
    <DesignShell current="home">
      <HomeHub sky={sky} homePath={signedIn ? "/" : "/guide"} strip={strip} />

      <div className="hm-legacy-head">
        <h2>Your reading and the Guide</h2>
        <p>
          Choose above, or fill these in here. Your birth details are filled in from your saved profile if you have
          one. Nothing is sent until you press the button on a form.
        </p>
      </div>
      <div className="hm-legacy">
        <PatternsNote />
        <ReadingForm
          key={`${period}-${focus}-${depth}`}
          defaults={defaults}
          initialKind={period}
          initialFocus={focus ?? (period ? "" : undefined)}
          initialDepth={depth}
        />
        <AiGuideForm key={`${question}-${depth}`} defaults={defaults} initialQuestion={question} initialDepth={depth} />
      </div>
    </DesignShell>
  );
}
