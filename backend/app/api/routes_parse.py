from fastapi import APIRouter, HTTPException

from app.api.models import JsonValue, ParseRequest, ParseResponse, SourceFormat
from app.core.parsers.edi_214_parser import parse_edi_214
from app.core.parsers.edi_856_parser import parse_edi_856
from app.core.parsers.errors import ParseError
from app.core.parsers.json_parser import parse_json
from app.core.parsers.xml_parser import parse_xml

router = APIRouter(prefix="/parse", tags=["parse"])


@router.post("", response_model=ParseResponse)
def parse_payload(request: ParseRequest) -> ParseResponse:
    try:
        canonical = _parse_by_format(request.format, request.content)
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


def _parse_by_format(source_format: SourceFormat, content: str) -> JsonValue:
    match source_format:
        case SourceFormat.json:
            return parse_json(content)
        case SourceFormat.xml:
            return parse_xml(content)
        case SourceFormat.edi_214:
            return parse_edi_214(content)
        case SourceFormat.edi_856:
            return parse_edi_856(content)
