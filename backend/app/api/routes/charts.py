"""Chart calculation routes."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.errors import BIRTH_DATA_ERROR_RESPONSES
from app.api.schemas import (
    CompareChartRequest,
    CompareChartResponse,
    VedicChartRequest,
    VedicChartResponse,
    WesternChartRequest,
    WesternChartResponse,
)
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.astrology.compare.service import calculate_comparison
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart

router = APIRouter(prefix="/charts", tags=["charts"])


@router.post(
    "/vedic",
    response_model=VedicChartResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate a Vedic D1 (Rashi) chart",
    responses=BIRTH_DATA_ERROR_RESPONSES,
)
def calculate_vedic_chart(request: VedicChartRequest) -> VedicChartResponse:
    """Calculate the Janma Kundali for a birth record.

    Deterministic: the same birth data and configuration always produce the
    same chart, and the configuration used is echoed back in
    `chart.metadata` so any result can be reproduced or explained later.

    An unknown birth time is a valid request, not an error. The response omits
    `ascendant` and `bhavas`, lists them in `metadata.unavailable`, and marks
    any graha whose placement is not stable across the 24-hour window.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    chart = calculate_d1_chart(request.birth, config)
    return VedicChartResponse(chart=chart)


@router.post(
    "/western",
    response_model=WesternChartResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate a Western natal chart",
    responses=BIRTH_DATA_ERROR_RESPONSES,
)
def calculate_western(request: WesternChartRequest) -> WesternChartResponse:
    """Calculate the tropical natal chart for a birth record.

    Runs an entirely separate pipeline from the Vedic endpoint. The two share
    only birth-moment resolution; the zodiac, the house division and the body
    set all differ, and engineering spec §16 requires the calculation rules
    stay unmerged. Longitudes here differ from the Vedic ones by the ayanamsa,
    currently about 24 degrees - nearly a whole sign - which is why the two
    systems disagree about a Sun sign.

    An unknown birth time is accepted. Bodies keep their signs, while the
    angles and houses are omitted and named in `chart.metadata.unavailable`.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    return WesternChartResponse(chart=calculate_western_chart(request.birth, config))


@router.post(
    "/compare",
    response_model=CompareChartResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate the Vedic and Western charts and compare them",
    responses=BIRTH_DATA_ERROR_RESPONSES,
)
def compare_charts(request: CompareChartRequest) -> CompareChartResponse:
    """Calculate both charts for one birth record and report why they differ.

    Product spec §6: Compare is not a side-by-side viewer. Every disagreement
    between the two charts traces back to one number, the ayanamsa, which is
    surfaced in `comparison.metadata.ayanamsa_degrees`; `comparison.
    shared_bodies` shows the effect on each body that both systems calculate,
    and `comparison.ascendant` shows it on the Lagna versus the Ascendant.
    Neither system is presented as more accurate than the other.

    An unknown birth time is accepted, same as the two chart endpoints it
    builds on. `ascendant` is omitted and named in `metadata.unavailable`;
    everything else in the comparison is still produced.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    return CompareChartResponse(comparison=calculate_comparison(request.birth, config))
