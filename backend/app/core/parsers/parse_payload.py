from app.api.models import JsonValue, SourceFormat
from app.core.parsers.edi_214_parser import parse_edi_214
from app.core.parsers.edi_856_parser import parse_edi_856
from app.core.parsers.json_parser import parse_json
from app.core.parsers.xml_parser import parse_xml


def parse_by_format(source_format: SourceFormat, content: str) -> JsonValue:
    match source_format:
        case SourceFormat.json:
            return parse_json(content)
        case SourceFormat.xml:
            return parse_xml(content)
        case SourceFormat.edi_214:
            return parse_edi_214(content)
        case SourceFormat.edi_856:
            return parse_edi_856(content)
