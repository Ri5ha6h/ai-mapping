import json
import re
import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.api.models import (
    MappingSpec,
    MappingTemplate,
    OutputFormat,
    SchemaNode,
    SourceFormat,
    TemplateCreateRequest,
    TemplateVersion,
    TemplateVersionCreateRequest,
    ValidationErrorItem,
)
from app.core.storage.seed_templates import seeded_templates


class TemplateNotFoundError(KeyError):
    pass


class TemplateAlreadyExistsError(ValueError):
    pass


class TemplateRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def list_templates(self, *, include_deleted: bool = False) -> list[MappingTemplate]:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            deleted_clause = "" if include_deleted else "where deleted_at is null"
            rows = connection.execute(
                f"""
                select template_id, name, description, active_version, is_seeded, deleted_at
                from templates
                {deleted_clause}
                order by lower(name)
                """
            ).fetchall()
            templates = [self._template_from_row(connection, row) for row in rows]
            return [template for template in templates if template is not None]

    def get_template(self, template_id: str, *, include_deleted: bool = True) -> MappingTemplate:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            deleted_clause = "" if include_deleted else "and deleted_at is null"
            row = connection.execute(
                f"""
                select template_id, name, description, active_version, is_seeded, deleted_at
                from templates
                where template_id = ?
                {deleted_clause}
                """,
                (template_id,),
            ).fetchone()
            if row is None:
                raise TemplateNotFoundError(template_id)
            template = self._template_from_row(connection, row)
            if template is None:
                raise TemplateNotFoundError(template_id)
            return template

    def soft_delete_template(self, template_id: str) -> MappingTemplate:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            row = connection.execute(
                "select template_id, is_seeded from templates where template_id = ?",
                (template_id,),
            ).fetchone()
            if row is None or bool(row["is_seeded"]):
                raise TemplateNotFoundError(template_id)

            now = _timestamp()
            with connection:
                connection.execute(
                    """
                    update templates
                    set deleted_at = coalesce(deleted_at, ?), updated_at = ?
                    where template_id = ?
                    """,
                    (now, now, template_id),
                )

            return self.get_template(template_id, include_deleted=True)

    def restore_template(self, template_id: str) -> MappingTemplate:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            row = connection.execute(
                "select template_id from templates where template_id = ?",
                (template_id,),
            ).fetchone()
            if row is None:
                raise TemplateNotFoundError(template_id)

            with connection:
                connection.execute(
                    """
                    update templates
                    set deleted_at = null, updated_at = ?
                    where template_id = ?
                    """,
                    (_timestamp(), template_id),
                )

            return self.get_template(template_id, include_deleted=True)

    def create_template(self, request: TemplateCreateRequest) -> MappingTemplate:
        template_id = request.template_id or _slugify(request.name)
        version = _template_version_from_request(request, version_number=1)
        now = _timestamp()

        with closing(self._connect()) as connection:
            self._initialize(connection)
            try:
                with connection:
                    connection.execute(
                        """
                        insert into templates (
                            template_id, name, description, active_version, created_at, updated_at
                        )
                        values (?, ?, ?, ?, ?, ?)
                        """,
                        (template_id, request.name, request.description, 1, now, now),
                    )
                    self._insert_version(connection, template_id, version)
            except sqlite3.IntegrityError as exc:
                raise TemplateAlreadyExistsError(template_id) from exc

            return self.get_template(template_id)

    def create_version(
        self,
        template_id: str,
        request: TemplateVersionCreateRequest,
    ) -> MappingTemplate:
        with closing(self._connect()) as connection:
            self._initialize(connection)
            current = connection.execute(
                "select active_version from templates where template_id = ? and deleted_at is null",
                (template_id,),
            ).fetchone()
            if current is None:
                raise TemplateNotFoundError(template_id)

            next_version = int(
                connection.execute(
                    """
                    select coalesce(max(version), 0) + 1
                    from template_versions
                    where template_id = ?
                    """,
                    (template_id,),
                ).fetchone()[0]
            )
            version = _template_version_from_request(request, version_number=next_version)

            with connection:
                self._insert_version(connection, template_id, version)
                connection.execute(
                    """
                    update templates
                    set active_version = ?, updated_at = ?
                    where template_id = ?
                    """,
                    (next_version, _timestamp(), template_id),
                )

            return self.get_template(template_id)

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
                create table if not exists templates (
                    template_id text primary key,
                    name text not null,
                    description text not null default '',
                    active_version integer not null,
                    is_seeded integer not null default 0,
                    deleted_at text,
                    created_at text not null,
                    updated_at text not null
                )
                """
            )
            connection.execute(
                """
                create table if not exists template_versions (
                    template_id text not null,
                    version integer not null,
                    source_format text not null,
                    target_format text not null,
                    source_schema_id text,
                    target_schema_id text,
                    source_schema_snapshot_json text,
                    target_schema_snapshot_json text,
                    mapping_spec_json text not null,
                    validation_rules_json text not null,
                    sample_source_content text,
                    sample_target_content text,
                    created_at text not null,
                    primary key (template_id, version),
                    foreign key (template_id) references templates(template_id)
                )
                """
            )
            self._ensure_column(
                connection,
                "templates",
                "is_seeded",
                "integer not null default 0",
            )
            self._ensure_column(
                connection,
                "templates",
                "deleted_at",
                "text",
            )
            self._ensure_column(
                connection,
                "template_versions",
                "source_schema_id",
                "text",
            )
            self._ensure_column(
                connection,
                "template_versions",
                "target_schema_id",
                "text",
            )
            self._ensure_column(
                connection,
                "template_versions",
                "sample_source_content",
                "text",
            )
            self._ensure_column(
                connection,
                "template_versions",
                "sample_target_content",
                "text",
            )
            self._seed_templates(connection)

    def _ensure_column(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        column_name: str,
        column_definition: str,
    ) -> None:
        columns = {
            row["name"] for row in connection.execute(f"pragma table_info({table_name})").fetchall()
        }
        if column_name in columns:
            return
        connection.execute(f"alter table {table_name} add column {column_name} {column_definition}")

    def _seed_templates(self, connection: sqlite3.Connection) -> None:
        templates = seeded_templates()
        seed_ids = {template.template_id for template in templates}
        if seed_ids:
            placeholders = ", ".join("?" for _ in seed_ids)
            connection.execute(
                f"""
                delete from template_versions
                where template_id in (
                    select template_id
                    from templates
                    where is_seeded = 1
                    and template_id not in ({placeholders})
                )
                """,
                tuple(seed_ids),
            )
            connection.execute(
                f"""
                delete from templates
                where is_seeded = 1
                and template_id not in ({placeholders})
                """,
                tuple(seed_ids),
            )

        for template in templates:
            created_at = template.versions[0].created_at.isoformat()
            cursor = connection.execute(
                """
                insert or ignore into templates (
                    template_id,
                    name,
                    description,
                    active_version,
                    is_seeded,
                    created_at,
                    updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    template.template_id,
                    template.name,
                    template.description,
                    template.active_version,
                    1,
                    created_at,
                    created_at,
                ),
            )
            if cursor.rowcount == 0:
                continue
            self._insert_version(connection, template.template_id, template.versions[0])

    def _template_from_row(
        self,
        connection: sqlite3.Connection,
        row: sqlite3.Row,
    ) -> MappingTemplate | None:
        versions = [
            version
            for version_row in connection.execute(
                """
                select
                    version,
                    source_format,
                    target_format,
                    source_schema_id,
                    target_schema_id,
                    source_schema_snapshot_json,
                    target_schema_snapshot_json,
                    mapping_spec_json,
                    validation_rules_json,
                    sample_source_content,
                    sample_target_content,
                    created_at
                from template_versions
                where template_id = ?
                order by version
                """,
                (row["template_id"],),
            ).fetchall()
            if (version := _version_from_row(version_row)) is not None
        ]
        if not versions:
            return None
        return MappingTemplate(
            template_id=row["template_id"],
            name=row["name"],
            description=row["description"],
            active_version=row["active_version"],
            is_seeded=bool(row["is_seeded"]),
            deleted_at=_datetime_or_none(row["deleted_at"]),
            versions=versions,
        )

    def _insert_version(
        self,
        connection: sqlite3.Connection,
        template_id: str,
        version: TemplateVersion,
    ) -> None:
        connection.execute(
            """
            insert into template_versions (
                template_id,
                version,
                source_format,
                target_format,
                source_schema_id,
                target_schema_id,
                source_schema_snapshot_json,
                target_schema_snapshot_json,
                mapping_spec_json,
                validation_rules_json,
                sample_source_content,
                sample_target_content,
                created_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                template_id,
                version.version,
                version.source_format.value,
                version.target_format.value,
                version.source_schema_id,
                version.target_schema_id,
                _model_json_or_none(version.source_schema_snapshot),
                _model_json_or_none(version.target_schema_snapshot),
                version.mapping_spec.model_dump_json(),
                json.dumps(
                    [
                        validation_rule.model_dump(mode="json")
                        for validation_rule in version.validation_rules
                    ]
                ),
                version.sample_source_content,
                version.sample_target_content,
                version.created_at.isoformat(),
            ),
        )


def _template_version_from_request(
    request: TemplateCreateRequest | TemplateVersionCreateRequest,
    *,
    version_number: int,
) -> TemplateVersion:
    return TemplateVersion(
        version=version_number,
        source_format=request.source_format,
        target_format=request.target_format,
        source_schema_id=request.source_schema_id,
        target_schema_id=request.target_schema_id,
        source_schema_snapshot=request.source_schema_snapshot,
        target_schema_snapshot=request.target_schema_snapshot,
        mapping_spec=request.mapping_spec,
        validation_rules=request.validation_rules,
        sample_source_content=request.sample_source_content,
        sample_target_content=request.sample_target_content,
        created_at=datetime.now(UTC),
    )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "mapping-template"


def _version_from_row(row: sqlite3.Row) -> TemplateVersion | None:
    try:
        return TemplateVersion(
            version=row["version"],
            source_format=SourceFormat(row["source_format"]),
            target_format=OutputFormat(row["target_format"]),
            source_schema_id=row["source_schema_id"],
            target_schema_id=row["target_schema_id"],
            source_schema_snapshot=_schema_or_none(row["source_schema_snapshot_json"]),
            target_schema_snapshot=_schema_or_none(row["target_schema_snapshot_json"]),
            mapping_spec=MappingSpec.model_validate_json(row["mapping_spec_json"]),
            validation_rules=[
                ValidationErrorItem.model_validate(item)
                for item in json.loads(row["validation_rules_json"])
            ],
            sample_source_content=row["sample_source_content"],
            sample_target_content=row["sample_target_content"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
    except (ValueError, TypeError, ValidationError, json.JSONDecodeError):
        return None


def _schema_or_none(value: str | None) -> SchemaNode | None:
    if value is None:
        return None
    return SchemaNode.model_validate_json(value)


def _model_json_or_none(value: Any) -> str | None:
    if value is None:
        return None
    return value.model_dump_json()


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _datetime_or_none(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value)
