import Link from "next/link";

import type { PlanetExploration } from "@/lib/types";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200">{children}</dd>
    </div>
  );
}

/** What was calculated or curated about one planet, kept apart from the
 * interpretation, which is the AI Guide's job (product spec §1). */
export function PlanetResult({ exploration }: { exploration: PlanetExploration }) {
  const { placement, transit, position, aspects, about } = exploration;
  const question = `How does my ${exploration.body} read in my ${exploration.system === "vedic" ? "Vedic" : "Western"} chart?`;

  return (
    <section className="flex flex-col gap-5 panel reveal p-6">
      <h2 className="display text-lg font-semibold text-amber-300">
        {exploration.body}{" "}
        <span className="text-sm font-normal text-slate-500">
          · {exploration.system === "vedic" ? "Vedic" : "Western"}
        </span>
      </h2>

      {placement && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Rashi">
            {placement.rashi} {placement.degrees_in_rashi.toFixed(2)}°
            {placement.retrograde && (
              <span className="ml-1 text-xs text-amber-400">(Rx)</span>
            )}
          </Fact>
          <Fact label="Nakshatra">
            {placement.nakshatra.name} (pada {placement.nakshatra.pada})
          </Fact>
          <Fact label="Bhava">{placement.bhava ?? "—"}</Fact>
          <Fact label="Certainty">
            {placement.certainty.rashi_certain &&
            placement.certainty.nakshatra_certain &&
            placement.certainty.pada_certain
              ? "Firm"
              : [
                  !placement.certainty.rashi_certain && "rashi",
                  !placement.certainty.nakshatra_certain && "nakshatra",
                  !placement.certainty.pada_certain && "pada",
                ]
                  .filter(Boolean)
                  .join(", ") + " uncertain"}
          </Fact>
        </dl>
      )}

      {transit && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Now: </span>
          in {transit.transit.rashi}
          {transit.transit.retrograde && (
            <span className="ml-1 text-xs text-amber-400">(Rx)</span>
          )}
          {transit.bhava_from_moon !== null &&
            `, house ${transit.bhava_from_moon} from your Moon`}
          {transit.in_natal_rashi && ", back in its natal rashi"}.
        </p>
      )}

      {position && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Sign">
            {position.sign} {position.degrees_in_sign.toFixed(2)}°
            {position.retrograde && (
              <span className="ml-1 text-xs text-amber-400">(Rx)</span>
            )}
          </Fact>
          <Fact label="House">{position.house ?? "—"}</Fact>
          <Fact label="Element">{position.element}</Fact>
          <Fact label="Modality">{position.modality}</Fact>
        </dl>
      )}

      {exploration.system === "western" && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-400">Aspects</h3>
          {aspects.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-slate-300">
              {aspects.map((aspect) => (
                <li key={`${aspect.first}-${aspect.second}-${aspect.aspect}`}>
                  {aspect.first} {aspect.aspect} {aspect.second}
                  <span className="text-slate-500">
                    {" "}
                    · orb {aspect.orb.toFixed(2)}°
                    {aspect.applying ? " · applying" : " · separating"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No aspects within orb.</p>
          )}
        </div>
      )}

      {about && (
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-medium text-slate-400">
            Traditional view
            <span className="ml-2 text-xs text-slate-600">
              {about.title} · v{about.version}
            </span>
          </h3>
          <p className="whitespace-pre-wrap text-sm text-slate-300">{about.text}</p>
        </div>
      )}

      <Link
        href={`/?q=${encodeURIComponent(question)}#ask`}
        className="self-start text-sm text-amber-300 transition hover:text-amber-200"
      >
        Ask the guide how this reads in your chart →
      </Link>
    </section>
  );
}
