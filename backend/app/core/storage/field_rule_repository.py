import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from app.api.models import FieldValidationRule, FieldValidationRuleUpsertRequest, SchemaDirection
from app.core.storage.schema_repository import SchemaArtifactNotFoundError, SchemaArtifactRepository


class FieldRuleSchemaDirectionError(ValueError):
    pass


class FieldValidationRuleRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def list_rules(self, schema_id: str) -> list[FieldValidationRule]:
        self._require_target_schema(schema_id)
        with closing(self._connect()) as connection:
            self._initialize(connection)
            rows = connection.execute(
                """
                select * from field_validation_rules
                where schema_id = ?
                order by path
                """,
                (schema_id,),
            ).fetchall()
            return [_rule_from_row(row) for row in rows]

    def upsert_rule(
        self,
        schema_id: str,
        request: FieldValidationRuleUpsertRequest,
    ) -> FieldValidationRule:
        self._require_target_schema(schema_id)
        now = _timestamp()
        with closing(self._connect()) as connection:
            self._initialize(connection)
            existing = connection.execute(
                """
                select created_at from field_validation_rules
                where schema_id = ? and path = ?
                """,
                (schema_id, request.path),
            ).fetchone()
            created_at = existing["created_at"] if existing else now
            with connection:
                connection.execute(
                    """
                    insert into field_validation_rules (
                        schema_id, path, value_type, required, min_value, max_value,
                        min_length, max_length, description, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    on conflict(schema_id, path) do update set
                        value_type = excluded.value_type,
                        required = excluded.required,
                        min_value = excluded.min_value,
                        max_value = excluded.max_value,
                        min_length = excluded.min_length,
                        max_length = excluded.max_length,
                        description = excluded.description,
                        updated_at = excluded.updated_at
                    """,
                    (
                        schema_id,
                        request.path,
                        request.value_type,
                        int(request.required),
                        request.min_value,
                        request.max_value,
                        request.min_length,
                        request.max_length,
                        request.description,
                        created_at,
                        now,
                    ),
                )
            return self._get_rule(connection, schema_id, request.path)

    def delete_rule(self, schema_id: str, path: str) -> None:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            with connection:
                connection.execute(
                    "delete from field_validation_rules where schema_id = ? and path = ?",
                    (schema_id, path),
                )

    def clear_rules(self) -> None:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            with connection:
                connection.execute("delete from field_validation_rules")

    def _require_target_schema(self, schema_id: str) -> None:
        schema = SchemaArtifactRepository(self.db_path).get_schema(schema_id, include_deleted=True)
        if schema.direction != SchemaDirection.target:
            raise FieldRuleSchemaDirectionError(schema_id)

    def _get_rule(
        self,
        connection: sqlite3.Connection,
        schema_id: str,
        path: str,
    ) -> FieldValidationRule:
        row = connection.execute(
            """
            select * from field_validation_rules
            where schema_id = ? and path = ?
            """,
            (schema_id, path),
        ).fetchone()
        if row is None:
            raise KeyError(path)
        return _rule_from_row(row)

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self, connection: sqlite3.Connection) -> None:
        with connection:
            connection.execute(
                """
                create table if not exists field_validation_rules (
                    schema_id text not null,
                    path text not null,
                    value_type text not null,
                    required integer not null default 0,
                    min_value real,
                    max_value real,
                    min_length integer,
                    max_length integer,
                    description text,
                    created_at text not null,
                    updated_at text not null,
                    primary key (schema_id, path)
                )
                """
            )


def _rule_from_row(row: sqlite3.Row) -> FieldValidationRule:
    return FieldValidationRule(
        schema_id=row["schema_id"],
        path=row["path"],
        value_type=row["value_type"],
        required=bool(row["required"]),
        min_value=row["min_value"],
        max_value=row["max_value"],
        min_length=row["min_length"],
        max_length=row["max_length"],
        description=row["description"],
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


__all__ = [
    "FieldRuleSchemaDirectionError",
    "FieldValidationRuleRepository",
    "SchemaArtifactNotFoundError",
]
