from dataclasses import dataclass

from app.api.models import OutputFormat


@dataclass(frozen=True)
class ValidationPolicy:
    output_format: OutputFormat
    validates_target_schema: bool
    message: str


@dataclass(frozen=True)
class DiffPolicy:
    output_format: OutputFormat
    supported: bool
    message: str


def validation_policy_for(output_format: OutputFormat) -> ValidationPolicy:
    if output_format == OutputFormat.xml:
        return ValidationPolicy(
            output_format=output_format,
            validates_target_schema=False,
            message=(
                "XML outputs are validated as serializable XML. JSON-shaped target schema "
                "required-field and type checks are intentionally skipped."
            ),
        )
    return ValidationPolicy(
        output_format=output_format,
        validates_target_schema=True,
        message="JSON outputs are checked against target schema required fields and scalar types.",
    )


def diff_policy_for(output_format: OutputFormat) -> DiffPolicy:
    if output_format == OutputFormat.xml:
        return DiffPolicy(
            output_format=output_format,
            supported=False,
            message="XML output diff is not available; compare serialized XML samples externally.",
        )
    return DiffPolicy(
        output_format=output_format,
        supported=True,
        message="JSON output diff compares expected and actual JSON values by path.",
    )
