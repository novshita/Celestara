"use client";

import Link from "next/link";

import type { ExploreFormState } from "@/app/explore-actions";
import { EXPLORE_BODIES } from "@/lib/planets";
import type { ExploreSystem, PlanetExploration } from "@/lib/types";

export interface ExploreSelection {
  system: ExploreSystem;
  body: string;
}

/** Each body's disc, from the design. */
const ORB: Record<string, string> = {
  Sun: "su", Moon: "mo", Mars: "ma", Mercury: "me", Jupiter: "ju", Venus: "ve", Saturn: "sa",
  Rahu: "ra", Ketu: "ke", Uranus: "uranus", Neptune: "neptune", Pluto: "pluto",
};

/** One line of traditional meaning per graha, shown until the chart is calculated and the
 * fuller curated description arrives from the server. */
const BLURB: Record<string, string> = {
  Sun: "The Sun is traditionally linked with the self, vitality and authority. It shows where you shine and what you lead with.",
  Moon: "The Moon is traditionally linked with the mind, emotions and the sense of home. It shows how you feel and what steadies you.",
  Mars: "Mars is traditionally linked with energy, courage and drive. It shows how you act and what you fight for.",
  Mercury: "Mercury is traditionally linked with intellect, speech and trade. It shows how you think and communicate.",
  Jupiter: "Jupiter is traditionally linked with growth, learning and counsel. It shows where you expand and what you teach.",
  Venus: "Venus is traditionally linked with love, beauty and harmony. It shows what you value and who you draw close.",
  Saturn: "Saturn is traditionally linked with discipline, time and responsibility. It shows where you build slowly and what tests you.",
  Rahu: "Rahu, the north node, is traditionally linked with ambition and the unfamiliar. It shows what you reach toward.",
  Ketu: "Ketu, the south node, is traditionally linked with detachment and past patterns. It shows what you release.",
};

function Facts({ exploration }: { exploration: PlanetExploration }) {
  const { placement, transit, position, aspects } = exploration;
  return (
    <>
      {placement && (
        <dl className="cx-facts">
          <div>
            <dt>Rashi</dt>
            <dd>
              {placement.rashi} {placement.degrees_in_rashi.toFixed(2)}°{placement.retrograde ? " (Rx)" : ""}
            </dd>
          </div>
          <div>
            <dt>Nakshatra</dt>
            <dd>
              {placement.nakshatra.name} (pada {placement.nakshatra.pada})
            </dd>
          </div>
          <div>
            <dt>Bhava</dt>
            <dd>{placement.bhava ?? "—"}</dd>
          </div>
          <div>
            <dt>Certainty</dt>
            <dd>
              {placement.certainty.rashi_certain && placement.certainty.nakshatra_certain && placement.certainty.pada_certain
                ? "Firm"
                : `${[
                    !placement.certainty.rashi_certain && "rashi",
                    !placement.certainty.nakshatra_certain && "nakshatra",
                    !placement.certainty.pada_certain && "pada",
                  ]
                    .filter(Boolean)
                    .join(", ")} uncertain`}
            </dd>
          </div>
        </dl>
      )}
      {transit && (
        <p className="cx-hint" style={{ fontSize: 15, color: "var(--ink2)", marginTop: 14 }}>
          Right now: in {transit.transit.rashi}
          {transit.transit.retrograde ? " (Rx)" : ""}
          {transit.bhava_from_moon !== null && `, house ${transit.bhava_from_moon} from your Moon`}
          {transit.in_natal_rashi && ", back in its natal rashi"}.
        </p>
      )}
      {position && (
        <dl className="cx-facts">
          <div>
            <dt>Sign</dt>
            <dd>
              {position.sign} {position.degrees_in_sign.toFixed(2)}°{position.retrograde ? " (Rx)" : ""}
            </dd>
          </div>
          <div>
            <dt>House</dt>
            <dd>{position.house ?? "—"}</dd>
          </div>
          <div>
            <dt>Element</dt>
            <dd>{position.element}</dd>
          </div>
          <div>
            <dt>Modality</dt>
            <dd>{position.modality}</dd>
          </div>
        </dl>
      )}
      {exploration.system === "western" && (
        <div style={{ marginTop: 16 }}>
          <p className="cx-hint" style={{ marginBottom: 6 }}>Aspects</p>
          {aspects.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4, fontSize: 15 }}>
              {aspects.map((a) => (
                <li key={`${a.first}-${a.second}-${a.aspect}`}>
                  {a.first} {a.aspect} {a.second}
                  <span className="cx-hint">
                    {" "}· orb {a.orb.toFixed(2)}° · {a.applying ? "applying" : "separating"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cx-hint">No aspects within orb.</p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * "Explore a planet": pick a planet and a system and see where it sits in the chart above,
 * what it is doing now, and what it traditionally means. It uses the birth details the
 * chart was calculated from, so nothing is typed twice. Calculated and curated; no AI.
 */
export function ExplorePanel({
  calculated,
  selection,
  state,
  busy,
  onSelect,
}: {
  calculated: boolean;
  selection: ExploreSelection;
  state: ExploreFormState;
  busy: boolean;
  onSelect: (next: ExploreSelection) => void;
}) {
  const { system, body } = selection;
  const bodies = EXPLORE_BODIES[system];
  const loaded =
    state.status === "success" && state.exploration.body === body && state.exploration.system === system
      ? state.exploration
      : null;
  const question = `How does my ${body} read in my ${system === "vedic" ? "Vedic" : "Western"} chart?`;
  const about = loaded?.about ?? null;

  const choose = (next: ExploreSystem) => {
    const options = EXPLORE_BODIES[next];
    onSelect({ system: next, body: options.includes(body) ? body : "Sun" });
  };

  return (
    <section id="explore" aria-labelledby="eH" className="cx-explore">
      <h2 id="eH">Explore a planet</h2>
      <p className="cx-lede" style={{ marginTop: 12 }}>
        Where one planet sits in your chart, what it is doing now, and what it traditionally means. Calculated and
        curated, no AI involved.
      </p>

      <div className="cx-orbs" role="group" aria-label="Choose a planet">
        {bodies.map((name) => (
          <button
            key={name}
            type="button"
            className="cx-ob"
            aria-pressed={name === body}
            onClick={() => onSelect({ system, body: name })}
          >
            <i className={`cx-o-${ORB[name] ?? "mo"}`} aria-hidden="true" />
            {name}
          </button>
        ))}
      </div>

      <div className="cx-exp">
        <div>
          <h3>{body}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{about?.text ?? BLURB[body] ?? ""}</p>
          {about && (
            <p className="cx-hint" style={{ marginTop: 6 }}>
              {about.title} · v{about.version}
            </p>
          )}
          <Link className="cx-askg" href={`/guide?q=${encodeURIComponent(question)}#ask`}>
            Ask the Guide how {body} reads for me →
          </Link>
        </div>
        <div>
          <div className="cx-seg" role="group" aria-label="System">
            <button type="button" aria-pressed={system === "vedic"} onClick={() => choose("vedic")}>Vedic</button>
            <button type="button" aria-pressed={system === "western"} onClick={() => choose("western")}>Western</button>
          </div>
          <div style={{ marginTop: 18 }} aria-live="polite" aria-busy={busy}>
            {!calculated ? (
              <p className="cx-hint" style={{ fontSize: 15, color: "var(--ink2)" }}>
                Calculate a chart above to see where {body} sits for you.
              </p>
            ) : loaded ? (
              <Facts exploration={loaded} />
            ) : state.status === "error" ? (
              <p role="alert" className="cx-alert">{state.message}</p>
            ) : (
              <p className="cx-hint" style={{ fontSize: 15, color: "var(--ink2)" }}>Looking up {body}…</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
