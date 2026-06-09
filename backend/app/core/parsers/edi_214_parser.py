from app.core.parsers.edi_segment_parser import canonical_edi


def parse_edi_214(content: str) -> dict[str, object]:
    return canonical_edi(content, "214")

