from app.api.models import MappingRule


def jsonata_metadata_only(rules: list[MappingRule]) -> list[str]:
    return [rule.jsonata for rule in rules if rule.jsonata]

