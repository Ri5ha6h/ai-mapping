from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.api.models import (
    SchemaArtifact,
    SchemaArtifactCreateRequest,
    SchemaArtifactListResponse,
    SchemaDirection,
    SourceFormat,
)
from app.config.settings import get_settings
from app.core.parsers.errors import ParseError
from app.core.parsers.parse_payload import parse_by_format
from app.core.schema.infer_schema import infer_schema
from app.core.storage.schema_repository import (
    SchemaArtifactAlreadyExistsError,
    SchemaArtifactNotFoundError,
    SchemaArtifactRepository,
)

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.post("", response_model=SchemaArtifact)
def create_schema_artifact(request: SchemaArtifactCreateRequest) -> SchemaArtifact:
    _validate_schema_format(request.direction, request.format)
    try:
        canonical_sample = parse_by_format(request.format, request.content)
    except ParseError as exc:
        raise HTTPException(
            status_code=400,
            detail={"message": exc.message, "detail": exc.detail},
        ) from exc

    inferred_schema = infer_schema(canonical_sample)
    try:
        return _repository().create_schema(
            request,
            canonical_sample=canonical_sample,
            inferred_schema=inferred_schema,
            parse_metadata={
                "source_format": request.format.value,
                "schema_direction": request.direction.value,
            },
        )
    except SchemaArtifactAlreadyExistsError as exc:
        raise HTTPException(
            status_code=409,
            detail={"message": f"Schema {exc.args[0]} already exists."},
        ) from exc


@router.get("", response_model=SchemaArtifactListResponse)
def list_schema_artifacts(
    direction: SchemaDirection | None = None,
    include_deleted: bool = Query(default=False),
) -> SchemaArtifactListResponse:
    return SchemaArtifactListResponse(
        schemas=_repository().list_schemas(
            direction=direction,
            include_deleted=include_deleted,
        )
    )


@router.get("/{schema_id}", response_model=SchemaArtifact)
def get_schema_artifact(schema_id: str) -> SchemaArtifact:
    try:
        return _repository().get_schema(schema_id, include_deleted=True)
    except SchemaArtifactNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"message": f"Schema {schema_id} was not found."},
        ) from exc


@router.delete("/{schema_id}", response_model=SchemaArtifact)
def delete_schema_artifact(schema_id: str) -> SchemaArtifact:
    try:
        return _repository().soft_delete_schema(schema_id)
    except SchemaArtifactNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"message": f"Schema {schema_id} was not found."},
        ) from exc


def _validate_schema_format(direction: SchemaDirection, source_format: SourceFormat) -> None:
    if direction == SchemaDirection.target and source_format not in {
        SourceFormat.json,
        SourceFormat.xml,
    }:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Target schemas only support JSON and XML formats.",
                "detail": f"Received {source_format.value}.",
            },
        )


def _repository() -> SchemaArtifactRepository:
    return SchemaArtifactRepository(Path(get_settings().template_db_path))
