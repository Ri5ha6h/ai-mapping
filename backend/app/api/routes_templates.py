from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.api.models import (
    MappingTemplate,
    TemplateCreateRequest,
    TemplateListResponse,
    TemplateVersionCreateRequest,
)
from app.config.settings import get_settings
from app.core.storage.template_repository import (
    TemplateAlreadyExistsError,
    TemplateNotFoundError,
    TemplateRepository,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("", response_model=MappingTemplate)
def create_template(request: TemplateCreateRequest) -> MappingTemplate:
    try:
        return _repository().create_template(request)
    except TemplateAlreadyExistsError as exc:
        raise HTTPException(
            status_code=409,
            detail={"message": f"Template {exc.args[0]} already exists."},
        ) from exc


@router.get("", response_model=TemplateListResponse)
def list_templates() -> TemplateListResponse:
    return TemplateListResponse(templates=_repository().list_templates())


@router.get("/{template_id}", response_model=MappingTemplate)
def get_template(template_id: str) -> MappingTemplate:
    try:
        return _repository().get_template(template_id)
    except TemplateNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"message": f"Template {template_id} was not found."},
        ) from exc


@router.post("/{template_id}/versions", response_model=MappingTemplate)
def create_template_version(
    template_id: str,
    request: TemplateVersionCreateRequest,
) -> MappingTemplate:
    try:
        return _repository().create_version(template_id, request)
    except TemplateNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"message": f"Template {template_id} was not found."},
        ) from exc


def _repository() -> TemplateRepository:
    return TemplateRepository(Path(get_settings().template_db_path))
