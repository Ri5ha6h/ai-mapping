from dataclasses import dataclass

from app.core.parsers.errors import ParseError


@dataclass(frozen=True)
class EdiSegment:
    segment_id: str
    elements: list[str]
    raw: str


def parse_segments(content: str) -> list[EdiSegment]:
    raw_segments = [segment.strip() for segment in content.replace("\n", "").split("~")]
    segments: list[EdiSegment] = []

    for raw_segment in raw_segments:
        if not raw_segment:
            continue
        parts = raw_segment.split("*")
        segment_id = parts[0].strip()
        if not segment_id:
            raise ParseError("Invalid EDI input.", detail=f"Empty segment id in {raw_segment!r}.")
        segments.append(EdiSegment(segment_id=segment_id, elements=parts[1:], raw=raw_segment))

    if not segments:
        raise ParseError("Invalid EDI input.", detail="No EDI segments found.")

    return segments


def transaction_set_id(segments: list[EdiSegment]) -> str | None:
    for segment in segments:
        if segment.segment_id == "ST" and segment.elements:
            return segment.elements[0]
    return None


def canonical_edi(content: str, expected_transaction_set: str) -> dict[str, object]:
    segments = parse_segments(content)
    actual_transaction_set = transaction_set_id(segments)
    if actual_transaction_set != expected_transaction_set:
        raise ParseError(
            f"Expected EDI {expected_transaction_set} transaction set.",
            detail=f"Found {actual_transaction_set or 'unknown'} transaction set.",
        )

    return {
        "edi": {
            "transaction_set": expected_transaction_set,
            "segments": [
                {
                    "segment_id": segment.segment_id,
                    "elements": segment.elements,
                    "raw": segment.raw,
                }
                for segment in segments
            ],
            "raw": content,
        }
    }

