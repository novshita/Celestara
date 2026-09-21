# Reference charts

Charts produced by **independent astrology software**, used to check that our
calculations are actually correct and not merely self-consistent.

## Why this exists

The rest of the test suite proves the calculation layer agrees with itself. But
the "known good" values those tests pin were read off our own engine — so if the
engine were misconfigured (wrong ayanamsa, wrong sidereal frame, wrong node
type), every test would still pass while every chart was wrong.

Breaking that circle needs expected values from somewhere other than us. That's
what these fixtures are.

> **Never fill a fixture in using our own output.** Copying our numbers in makes
> the test pass by construction and verifies nothing. The values must come from
> other software.

## Adding a reference chart

You don't need to understand astrology for this. You're comparing numbers.

### 1. Pick a source

Any of these will do:

| Tool | Notes |
|---|---|
| [AstroSage](https://www.astrosage.com/freechart/) | Free, browser-based, no install |
| [Jagannatha Hora](https://www.vedicastrologer.org/jh/) | Free desktop, very widely trusted for Jyotish |
| [Prokerala](https://www.prokerala.com/astrology/birth-chart/) | Free, browser-based |

Make sure the tool is set to **Lahiri ayanamsa** — it's the default in most
Vedic software. If it offers a choice of house system, pick **whole sign**
(sometimes called "Rasi" or "Sripati" — whole sign is what we calculate).

### 2. Enter a birth record

Use anything, but prefer:

- A **known exact time**, so the Ascendant is well defined
- A date **outside a DST transition**, to keep one variable out of it
- A place whose **timezone you're sure of**

Don't use your own birth details if you'd rather not commit them — this file
gets pushed to GitHub. Any plausible date and place works fine.

### 3. Copy the numbers into a new file

Duplicate `_template.json` to something descriptive like
`astrosage_1990_mumbai.json`, then fill in:

- `source` — software name and version. A reference with no provenance isn't a
  reference.
- `birth` — the **exact same** details you entered into the tool
- `ascendant` and `placements` — sign, degrees, minutes (seconds if shown)

Files starting with `_` are ignored, so the template is never run as a test.

Sign names can be Sanskrit (`Vrischika`) or Western (`Scorpio`) — either works.
Omit `sec` if the tool doesn't show it. Omit `retrograde`, `nakshatra`, and
`pada` entirely if you don't want to transcribe them; they're only checked when
present.

### 4. Run the tests

```bash
cd backend && pytest tests/test_reference_charts.py -v
```

Failures print both values and the size of the disagreement:

```
Ascendant disagrees with AstroSage
  expected: Vrischika 20°43'54.00" (230.7317)
  ours:     Vrischika 20°43'53.81" (230.7316)
  off by:   0.01 arcmin (tolerance 2 arcmin)
```

## Reading the results

| What you see | What it means |
|---|---|
| All pass | The engine is correctly configured. This is the outcome we're after. |
| Everything off by the **same** amount | Ayanamsa problem — the sidereal reference is wrong. |
| Signs correct, minutes off by 1–2' | Normal. Different Lahiri implementations disagree over nutation (~14"), and transcription loses precision. Widen `tolerance_arcmin` if needed. |
| A body in the **wrong sign** | Real bug. Signs are 30° wide; rounding can't do that. |
| Only **Rahu/Ketu** wrong | Mean vs. true node. Most Vedic software uses mean, which is our default — check the tool's setting. |
| Only the **Ascendant** wrong | Time or timezone mismatch. The Ascendant moves ~1° every 4 minutes, so it's the first thing to break. |
| Only the **Moon** wrong | Also usually a time problem — the Moon moves ~13°/day, far faster than anything else. |

## Why the tolerance isn't tighter

Two arcminutes sounds loose but is thousands of times tighter than any error
that matters. A misconfigured ayanamsa is *degrees* off. A wrong house frame is
*30 degrees* off. Meanwhile legitimate differences between correct
implementations — nutation handling, rounding, transcribing from a screenshot —
land in the arcsecond-to-arcminute range. Tightening further would produce
failures that aren't bugs.
