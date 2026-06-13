from fastapi import APIRouter, HTTPException

from app.api.models import ParseRequest, ParseResponse
from app.core.parsers.errors import ParseError
from app.core.parsers.parse_payload import parse_by_format

router = APIRouter(prefix="/parse", tags=["parse"])


@router.post("", response_model=ParseResponse)
def parse_payload(request: ParseRequest) -> ParseResponse:
    try:
        canonical = parse_by_format(request.format, request.content)
    except ParseError as exc:
        raise HTTPException(
            status_code=400,
            detail={"message": exc.message, "detail": exc.detail},
        ) from exc

    return ParseResponse(
        format=request.format,
        canonical=canonical,
        metadata={"source_format": request.format.value},
    )
