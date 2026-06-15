from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_mapping import router as mapping_router
from app.api.routes_parse import router as parse_router
from app.api.routes_schema import router as schema_router
from app.api.routes_schemas import router as schemas_router
from app.api.routes_templates import router as templates_router
from app.api.routes_transform import router as transform_router
from app.config.settings import settings


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    cors_origins = settings.cors_origins or []
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(mapping_router, prefix=settings.api_prefix)
    app.include_router(parse_router, prefix=settings.api_prefix)
    app.include_router(schema_router, prefix=settings.api_prefix)
    app.include_router(schemas_router, prefix=settings.api_prefix)
    app.include_router(templates_router, prefix=settings.api_prefix)
    app.include_router(transform_router, prefix=settings.api_prefix)
    return app


app = create_app()
