from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.api.models import (
    FieldValidationRule,
    FieldValidationRuleListResponse,
    FieldValidationRuleUpsertRequest,
)
from app.config.settings import get_settings
from app.core.storage.field_rule_repository import (
    FieldRuleSchemaDirectionError,
    FieldValidationRuleRepository,
)
from app.core.storage.schema_repository import SchemaArtifactNotFoundError

router = APIRouter(prefix="/schemas/{schema_id}/field-rules", tags=["field-rules"])


@router.get("", response_model=FieldValidationRuleListResponse)
def list_field_validation_rules(schema_id: str) -> FieldValidationRuleListResponse:
    try:
        return FieldValidationRuleListResponse(rules=_repository().list_rules(schema_id))
    except SchemaArtifactNotFoundError as exc:
        raise _schema_not_found(schema_id) from exc
    except FieldRuleSchemaDirectionError as exc:
        raise _source_schema_error(schema_id) from exc


@router.put("/{path:path}", response_model=FieldValidationRule)
def upsert_field_validation_rule(
    schema_id: str,
    path: str,
    request: FieldValidationRuleUpsertRequest,
) -> FieldValidationRule:
    rule_request = request.model_copy(update={"path": path or request.path})
    try:
        return _repository().upsert_rule(schema_id, rule_request)
    except SchemaArtifactNotFoundError as exc:
        raise _schema_not_found(schema_id) from exc
    except FieldRuleSchemaDirectionError as exc:
        raise _source_schema_error(schema_id) from exc


def _repository() -> FieldValidationRuleRepository:
    return FieldValidationRuleRepository(Path(get_settings().template_db_path))


def _schema_not_found(schema_id: str) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"message": f"Schema {schema_id} was not found."},
    )


def _source_schema_error(schema_id: str) -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={"message": f"Field validation rules are only available for target schemas ({schema_id})."},
    )
