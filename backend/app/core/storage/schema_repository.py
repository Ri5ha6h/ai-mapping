import json
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from app.api.models import (
    JsonValue,
    SchemaArtifact,
    SchemaArtifactCreateRequest,
    SchemaDirection,
    SchemaInputMethod,
    SchemaNode,
    SourceFormat,
)


class SchemaArtifactNotFoundError(KeyError):
    pass


class SchemaArtifactAlreadyExistsError(ValueError):
    pass


class SchemaArtifactRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def create_schema(
        self,
        request: SchemaArtifactCreateRequest,
        *,
        canonical_sample: JsonValue,
        inferred_schema: SchemaNode,
        parse_metadata: dict[str, object],
    ) -> SchemaArtifact:
        now = _timestamp()
        original_size = request.original_size
        if original_size is None:
            original_size = len(request.content.encode())

        with closing(self._connect()) as connection:
            self._initialize(connection)
            schema_id = self._schema_id(connection, request)
            with connection:
                connection.execute(
                    """
                    insert into schemas (
                        schema_id,
                        name,
                        description,
                        direction,
                        format,
                        original_content,
                        original_filename,
                        original_content_type,
                        original_size,
                        input_method,
                        canonical_sample_json,
                        inferred_schema_json,
                        parse_metadata_json,
                        deleted_at,
                        created_at
                    )
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        schema_id,
                        request.name,
                        request.description,
                        request.direction.value,
                        request.format.value,
                        request.content,
                        request.original_filename,
                        request.original_content_type,
                        original_size,
                        request.input_method.value,
                        json.dumps(canonical_sample),
                        inferred_schema.model_dump_json(),
                        json.dumps(parse_metadata),
                        None,
                        now,
                    ),
                )
            return self.get_schema(schema_id, include_deleted=True)

    def list_schemas(
        self,
        *,
        direction: SchemaDirection | None = None,
        include_deleted: bool = False,
    ) -> list[SchemaArtifact]:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            clauses: list[str] = []
            params: list[str] = []
            if direction is not None:
                clauses.append("direction = ?")
                params.append(direction.value)
            if not include_deleted:
                clauses.append("deleted_at is null")

            where_clause = f"where {' and '.join(clauses)}" if clauses else ""
            rows = connection.execute(
                f"""
                select *
                from schemas
                {where_clause}
                order by lower(name), created_at desc
                """,
                params,
            ).fetchall()
            return [_schema_from_row(row) for row in rows]

    def get_schema(
        self,
        schema_id: str,
        *,
        include_deleted: bool = True,
    ) -> SchemaArtifact:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            deleted_clause = "" if include_deleted else "and deleted_at is null"
            row = connection.execute(
                f"""
                select *
                from schemas
                where schema_id = ?
                {deleted_clause}
                """,
                (schema_id,),
            ).fetchone()
            if row is None:
                raise SchemaArtifactNotFoundError(schema_id)
            return _schema_from_row(row)

    def soft_delete_schema(self, schema_id: str) -> SchemaArtifact:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            row = connection.execute(
                "select schema_id from schemas where schema_id = ?",
                (schema_id,),
            ).fetchone()
            if row is None:
                raise SchemaArtifactNotFoundError(schema_id)

            with connection:
                connection.execute(
                    """
                    update schemas
                    set deleted_at = coalesce(deleted_at, ?)
                    where schema_id = ?
                    """,
                    (_timestamp(), schema_id),
                )

            return self.get_schema(schema_id, include_deleted=True)

    def restore_schema(self, schema_id: str) -> SchemaArtifact:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            row = connection.execute(
                "select schema_id from schemas where schema_id = ?",
                (schema_id,),
            ).fetchone()
            if row is None:
                raise SchemaArtifactNotFoundError(schema_id)

            with connection:
                connection.execute(
                    """
                    update schemas
                    set deleted_at = null
                    where schema_id = ?
                    """,
                    (schema_id,),
                )

            return self.get_schema(schema_id, include_deleted=True)

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("pragma foreign_keys = on")
        return connection

    def _initialize(self, connection: sqlite3.Connection) -> None:
        with connection:
            connection.execute(
                """
                create table if not exists schemas (
                    schema_id text primary key,
                    name text not null,
                    description text not null default '',
                    direction text not null,
                    format text not null,
                    original_content text not null,
                    original_filename text,
                    original_content_type text,
                    original_size integer not null,
                    input_method text not null,
                    canonical_sample_json text not null,
                    inferred_schema_json text not null,
                    parse_metadata_json text not null,
                    deleted_at text,
                    created_at text not null
                )
                """
            )

    def _schema_id(
        self,
        connection: sqlite3.Connection,
        request: SchemaArtifactCreateRequest,
    ) -> str:
        if request.schema_id:
            if self._schema_id_exists(connection, request.schema_id):
                raise SchemaArtifactAlreadyExistsError(request.schema_id)
            return request.schema_id

        base = _slugify(request.name)
        candidate = base
        suffix = 2
        while self._schema_id_exists(connection, candidate):
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    def _schema_id_exists(self, connection: sqlite3.Connection, schema_id: str) -> bool:
        row = connection.execute(
            "select 1 from schemas where schema_id = ?",
            (schema_id,),
        ).fetchone()
        return row is not None


def _schema_from_row(row: sqlite3.Row) -> SchemaArtifact:
    return SchemaArtifact(
        schema_id=row["schema_id"],
        name=row["name"],
        description=row["description"],
        direction=SchemaDirection(row["direction"]),
        format=SourceFormat(row["format"]),
        original_content=row["original_content"],
        original_filename=row["original_filename"],
        original_content_type=row["original_content_type"],
        original_size=row["original_size"],
        input_method=SchemaInputMethod(row["input_method"]),
        canonical_sample=json.loads(row["canonical_sample_json"]),
        inferred_schema=SchemaNode.model_validate_json(row["inferred_schema_json"]),
        parse_metadata=json.loads(row["parse_metadata_json"]),
        deleted_at=_datetime_or_none(row["deleted_at"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "schema"


def _datetime_or_none(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()
