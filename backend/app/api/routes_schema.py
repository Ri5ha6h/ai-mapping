from fastapi import APIRouter

from app.api.models import SchemaInferRequest, SchemaInferResponse
from app.core.schema.infer_schema import infer_schema

router = APIRouter(prefix="/schema", tags=["schema"])


@router.post("/infer", response_model=SchemaInferResponse)
def infer_payload_schema(request: SchemaInferRequest) -> SchemaInferResponse:
    return SchemaInferResponse(schema=infer_schema(request.data))
