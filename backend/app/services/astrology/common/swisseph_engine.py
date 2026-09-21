"""Swiss Ephemeris adapter.

The only module permitted to import `swisseph`. Three behaviours here exist
because a validation probe caught them producing wrong or unstable output;
each is commented at its site:

1. Houses must be requested with FLG_SIDEREAL or whole-sign bhavas come back
   keyed to the tropical Ascendant - a full 30 deg error.
2. Sidereal longitudes come from FLG_SIDEREAL only, never from subtracting
   `get_ayanamsa_ut()`, which is the *mean* ayanamsa and leaves nutation
   (up to ~17 arcsec) in the result.
3. The library silently falls back to Moshier when `.se1` files are missing,
   so the returned ephemeris flag is asserted against the configured source.
"""

from __future__ import annotations

import threading

import swisseph as swe

from app.core.config import (
    Ayanamsa,
    CalculationConfig,
    EphemerisSource,
    HouseSystem,
    NodeType,
)

from .ephemeris import BodyPosition, EphemerisError, HouseFrame

#: `swisseph` keeps ayanamsa mode and ephemeris path in process-global state,
#: so two requests configured differently would race. Every entry point that
#: touches that state holds this lock. Cheap: the calls are microseconds.
_SWE_LOCK = threading.Lock()

_BODY_IDS: dict[str, int] = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mars": swe.MARS,
    "Mercury": swe.MERCURY,
    "Jupiter": swe.JUPITER,
    "Venus": swe.VENUS,
    "Saturn": swe.SATURN,
}

_AYANAMSA_MODES: dict[Ayanamsa, int] = {
    Ayanamsa.LAHIRI: swe.SIDM_LAHIRI,
}

_HOUSE_CODES: dict[HouseSystem, bytes] = {
    HouseSystem.WHOLE_SIGN: b"W",
    HouseSystem.PLACIDUS: b"P",
    HouseSystem.EQUAL: b"E",
}

_EPHEMERIS_FLAGS: dict[EphemerisSource, int] = {
    EphemerisSource.MOSHIER: swe.FLG_MOSEPH,
    EphemerisSource.SWISS: swe.FLG_SWIEPH,
}

#: Bits in a return flag that identify which ephemeris actually served the
#: call, used to detect a silent downgrade.
_SOURCE_MASK = swe.FLG_MOSEPH | swe.FLG_SWIEPH | swe.FLG_JPLEPH


class SwissEphemerisEngine:
    """Ephemeris engine backed by `pyswisseph`.

    Implements the `EphemerisEngine` protocol.
    """

    def __init__(self, config: CalculationConfig) -> None:
        self._config = config

        try:
            self._ayanamsa_mode = _AYANAMSA_MODES[config.ayanamsa]
        except KeyError:
            raise EphemerisError(
                f"unsupported ayanamsa: {config.ayanamsa}"
            ) from None

        try:
            self._house_code = _HOUSE_CODES[config.house_system]
        except KeyError:
            raise EphemerisError(
                f"unsupported house system: {config.house_system}"
            ) from None

        try:
            self._source_flag = _EPHEMERIS_FLAGS[config.ephemeris_source]
        except KeyError:
            raise EphemerisError(
                f"unsupported ephemeris source: {config.ephemeris_source}"
            ) from None

        if config.ephemeris_source is EphemerisSource.SWISS:
            if not config.ephemeris_path:
                raise EphemerisError(
                    "ephemeris_source=swiss requires ephemeris_path to point at "
                    "the directory holding the .se1 data files"
                )

        self._node_id = (
            swe.MEAN_NODE if config.node_type is NodeType.MEAN else swe.TRUE_NODE
        )

        # Base flags for every position call. FLG_SIDEREAL is not optional -
        # see rule 2 in the module docstring.
        self._calc_flags = self._source_flag | swe.FLG_SPEED | swe.FLG_SIDEREAL

    # -- protocol ----------------------------------------------------------

    @property
    def engine_id(self) -> str:
        """e.g. ``swisseph-2.10.03/moshier/lahiri``."""
        return (
            f"swisseph-{swe.version}"
            f"/{self._config.ephemeris_source.value}"
            f"/{self._config.ayanamsa.value}"
        )

    def julian_day_ut(
        self, year: int, month: int, day: int, hour_fraction: float
    ) -> float:
        return swe.julday(year, month, day, hour_fraction)

    def sidereal_positions(
        self, jd_ut: float, bodies: tuple[str, ...]
    ) -> dict[str, BodyPosition]:
        positions: dict[str, BodyPosition] = {}

        with _SWE_LOCK:
            self._apply_global_state()

            for body in bodies:
                if body == "Ketu":
                    raise EphemerisError(
                        "Ketu is derived from Rahu, not calculated; request "
                        "'Rahu' and mirror it by 180 degrees"
                    )

                body_id = self._node_id if body == "Rahu" else _BODY_IDS.get(body)
                if body_id is None:
                    raise EphemerisError(f"unknown body: {body}")

                values, retflag = swe.calc_ut(jd_ut, body_id, self._calc_flags)
                self._assert_source(retflag, body)

                positions[body] = BodyPosition(
                    body=body,
                    longitude=values[0] % 360.0,
                    latitude=values[1],
                    distance_au=values[2],
                    speed_longitude=values[3],
                )

        return positions

    def sidereal_houses(
        self, jd_ut: float, latitude: float, longitude: float
    ) -> HouseFrame:
        with _SWE_LOCK:
            self._apply_global_state()

            # FLG_SIDEREAL here is the fix for rule 1. Without it, whole-sign
            # cusps are generated from the tropical Ascendant's sign while the
            # Ascendant we report is sidereal, putting every graha one rashi
            # away from its true bhava.
            cusps, ascmc = swe.houses_ex(
                jd_ut,
                latitude,
                longitude,
                self._house_code,
                swe.FLG_SIDEREAL,
            )

        if not cusps or len(cusps) < 12:
            raise EphemerisError(
                "engine returned no house cusps; this happens at extreme "
                "latitudes for some house systems"
            )

        return HouseFrame(
            ascendant=ascmc[0] % 360.0,
            midheaven=ascmc[1] % 360.0,
            cusps=tuple(c % 360.0 for c in cusps[:12]),
        )

    def ayanamsa(self, jd_ut: float) -> float:
        with _SWE_LOCK:
            self._apply_global_state()
            # `get_ayanamsa_ex_ut` with the *same* flags as the position calls
            # is the only variant consistent with FLG_SIDEREAL output. The
            # plain `get_ayanamsa_ut` is the mean value and differs by the
            # nutation term.
            retflag, value = swe.get_ayanamsa_ex_ut(jd_ut, self._calc_flags)
            self._assert_source(retflag, "ayanamsa")
        return value % 360.0

    # -- internals ---------------------------------------------------------

    def _apply_global_state(self) -> None:
        """Push this engine's configuration into swisseph's global state.

        Called under `_SWE_LOCK` before every calculation rather than once at
        construction, because another engine instance may have overwritten it
        in the meantime.
        """
        if self._config.ephemeris_path:
            swe.set_ephe_path(self._config.ephemeris_path)
        swe.set_sid_mode(self._ayanamsa_mode, 0, 0)

    def _assert_source(self, retflag: int, context: str) -> None:
        """Fail loudly if the engine served a different ephemeris than asked.

        Requesting SWIEPH without `.se1` files on disk returns Moshier output
        with no error. Silently accepting that would mean identical inputs
        producing different charts depending on what happens to be installed,
        breaking the reproducibility contract in engineering spec §10.
        """
        if retflag < 0:
            raise EphemerisError(
                f"engine rejected calculation for {context} (flag {retflag})"
            )

        served = retflag & _SOURCE_MASK
        if served != self._source_flag:
            raise EphemerisError(
                f"ephemeris source mismatch calculating {context}: requested "
                f"{self._config.ephemeris_source.value} "
                f"(flag {self._source_flag}) but the engine served flag "
                f"{served}. If this is a SWISS request, the .se1 data files "
                f"are missing from {self._config.ephemeris_path!r} and the "
                f"library fell back to Moshier."
            )
