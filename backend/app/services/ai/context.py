"""Turns a calculated chart into the plain-text "CALCULATED FACTS" block the
AI is given.

Engineering spec §15: "Build a structured context object containing only
relevant information" - "structured" here means deliberately curated, not
the raw Pydantic model dumped as JSON. A plain-English rendering is both
cheaper (far fewer tokens than a `model_dump_json()`) and safer: handing the
model its own JSON shape invites it to "parse" or "recompute" structure
instead of simply reading facts, which is exactly what the non-negotiable
"the LLM never calculates astrology" rules out.

Every formatter also renders `metadata.unavailable` and the birth moment's
`assumptions` verbatim when present - product spec §21/§29's "uncertainty is
shown, not hidden" applies to what the AI is told, not only to what the API
returns.
"""

from __future__ import annotations

from app.domain.compare import ChartComparison
from app.domain.transit import TransitReport
from app.domain.vedic import VedicChart
from app.domain.western import WesternChart


def _caveats(assumptions: tuple[str, ...], unavailable: tuple[str, ...]) -> str:
    lines: list[str] = []
    if assumptions:
        lines.append("Assumptions: " + " ".join(assumptions))
    if unavailable:
        lines.append("Unavailable: " + ", ".join(unavailable))
    return ("\n" + "\n".join(lines)) if lines else ""


def format_vedic_context(chart: VedicChart) -> str:
    lines = ["System: Vedic (sidereal, Lahiri ayanamsa, D1/Rashi chart)."]

    if chart.ascendant is not None:
        asc = chart.ascendant
        lines.append(
            f"Ascendant (Lagna): {asc.rashi} {asc.degrees_in_rashi:.2f} degrees, "
            f"{asc.nakshatra.name} pada {asc.nakshatra.pada}, lord {asc.lord}."
        )
    else:
        lines.append("Ascendant: unavailable (birth time unknown).")

    lines.append("Grahas:")
    for placement in chart.placements:
        retro = " (retrograde)" if placement.retrograde else ""
        bhava = f", bhava {placement.bhava}" if placement.bhava is not None else ""
        uncertain = "" if placement.certainty.fully_certain else " (uncertain)"
        lines.append(
            f"- {placement.graha}: {placement.rashi} "
            f"{placement.degrees_in_rashi:.2f} degrees{retro}, "
            f"{placement.nakshatra.name} pada {placement.nakshatra.pada}"
            f"{bhava}{uncertain}."
        )

    lines.append(f"Ayanamsa: {chart.metadata.ayanamsa_degrees:.4f} degrees.")
    lines.append(
        _caveats(chart.metadata.moment.assumptions, chart.metadata.unavailable)
    )
    return "\n".join(lines)


def format_western_context(chart: WesternChart) -> str:
    lines = ["System: Western (tropical zodiac)."]

    if chart.angles is not None:
        angles = chart.angles
        lines.append(
            f"Ascendant: {angles.ascendant_sign} "
            f"{angles.ascendant_degrees:.2f} degrees, ruler {angles.ascendant_ruler}. "
            f"Midheaven: {angles.midheaven_sign}."
        )
    else:
        lines.append("Angles: unavailable (birth time unknown).")

    lines.append("Bodies:")
    for position in chart.positions:
        retro = " (retrograde)" if position.retrograde else ""
        house = f", house {position.house}" if position.house is not None else ""
        uncertain = " (uncertain)" if position.uncertain else ""
        lines.append(
            f"- {position.body}: {position.sign} "
            f"{position.degrees_in_sign:.2f} degrees{retro}{house}{uncertain}."
        )

    if chart.aspects:
        lines.append("Aspects:")
        for aspect in chart.aspects:
            tone = (
                "harmonious"
                if aspect.harmonious
                else "challenging"
                if aspect.harmonious is False
                else "neutral"
            )
            lines.append(
                f"- {aspect.first} {aspect.aspect} {aspect.second} "
                f"(orb {abs(aspect.orb):.1f} degrees, {tone})."
            )

    lines.append(
        _caveats(chart.metadata.moment.assumptions, chart.metadata.unavailable)
    )
    return "\n".join(lines)


def format_compare_context(comparison: ChartComparison) -> str:
    lines = [
        "System: Compare - both Vedic (sidereal) and Western (tropical) "
        "calculations for the same birth, kept as two separate systems. "
        "Never state that one is objectively more accurate than the other.",
        f"Ayanamsa (the sidereal offset that explains every difference below): "
        f"{comparison.metadata.ayanamsa_degrees:.4f} degrees.",
    ]

    if comparison.ascendant is not None:
        asc = comparison.ascendant
        lines.append(
            f"Ascendant: {asc.vedic_rashi} (Vedic) vs. {asc.western_sign} "
            f"(Western), {asc.signs_apart} sign(s) apart."
        )
    else:
        lines.append("Ascendant: unavailable (birth time unknown).")

    lines.append("Shared bodies (both systems calculate these):")
    for body in comparison.shared_bodies:
        lines.append(
            f"- {body.body}: {body.vedic_rashi} "
            f"{body.vedic_degrees_in_rashi:.2f} degrees (Vedic) vs. "
            f"{body.western_sign} {body.western_degrees_in_sign:.2f} degrees "
            f"(Western), {body.signs_apart} sign(s) apart."
        )

    # Both halves share one birth-moment resolution, so either side's
    # assumptions list is the same list - `vedic`'s is used as the source.
    lines.append(
        _caveats(
            comparison.vedic.metadata.moment.assumptions,
            comparison.metadata.unavailable,
        )
    )
    return "\n".join(lines)


def format_daily_reading_context(report: TransitReport) -> str:
    """For `generate_daily_reading` - the natal chart's bearing (Ascendant,
    Moon rashi) plus each graha's current transit against it, exactly as a
    user would see at `/transits/vedic` for the same birth record."""
    lines = [
        "System: Vedic (sidereal) - today's transits (Gochar) related to "
        "the natal chart.",
        f"Moment: {report.snapshot.moment.isoformat()} (UTC).",
    ]

    if report.natal_ascendant_rashi:
        lines.append(f"Natal Ascendant: {report.natal_ascendant_rashi}.")
    if report.natal_moon_rashi:
        lines.append(f"Natal Moon rashi: {report.natal_moon_rashi}.")

    lines.append("Transits:")
    for item in report.transits:
        retro = " (retrograde)" if item.transit.retrograde else ""
        returned = " - returned to its natal rashi" if item.in_natal_rashi else ""
        bhava = (
            f", currently crossing bhava {item.bhava_from_ascendant} from "
            f"the Ascendant"
            if item.bhava_from_ascendant is not None
            else ""
        )
        lines.append(
            f"- {item.graha}: natal {item.natal_rashi}, now transiting "
            f"{item.transit.rashi}{retro}, "
            f"{item.separation_from_natal:.1f} degrees from its natal "
            f"position{bhava}{returned}."
        )

    lines.append(_caveats((), report.unavailable))
    return "\n".join(lines)
