"""Chart calculation routes."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.errors import BIRTH_DATA_ERROR_RESPONSES
from app.api.schemas import (
    VedicChartRequest,
    VedicChartResponse,
    WesternChartRequest,
    WesternChartResponse,
)
from app.core.config import DEFAULT_CALCULATION_CONFIG
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
