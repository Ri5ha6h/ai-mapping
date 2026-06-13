# Auto Mapping Backend

Phase 1 implements parsing and schema inference for JSON, XML, EDI 214, and EDI 856.
Phase 2 implements mapping suggestions from source and target schemas.
Phase 3 implements deterministic synchronous transformation and validation.
Phase 4 implements the frontend workbench.
Phase 5 implements local template persistence and versioning.
The current storage layer uses SQLite locally for reusable schema artifacts and
mapping templates, and seeds example templates for every deterministic rule type.

## Runtime

- Target Python: `3.14.5`
- Compatibility fallback: not used; local runtime is Python `3.14.5`

## Install

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

## Test

```bash
cd backend
pytest
ruff check .
pyright
```

## Run

```bash
cd backend
uvicorn app.main:app --reload
```

For isolated schema/template storage during demos:

```bash
TEMPLATE_DB_PATH=/tmp/automapping-templates.sqlite3 uvicorn app.main:app --reload
```

## Samples And Demo Scripts

Samples live in `backend/samples`:

- `source.json`
- `source.xml`
- `target.json`
- `target.xml`
- `edi_214.edi`
- `edi_856.edi`

Run the backend first, then execute any demo script from the repository root:

```bash
backend/scripts/demo_json_to_json.sh
backend/scripts/demo_xml_to_json.sh
backend/scripts/demo_json_to_xml.sh
backend/scripts/demo_edi_214.sh
backend/scripts/demo_edi_856.sh
```

Set `API_BASE_URL` if the backend is not on `http://127.0.0.1:8000`.

## Example Requests

JSON parse:

```bash
curl -s http://127.0.0.1:8000/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"format":"json","content":"{\"shipment\":{\"trackingNumber\":\"TRK123\"}}"}'
```

XML parse:

```bash
curl -s http://127.0.0.1:8000/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"format":"xml","content":"<Shipment><TrackingNumber>TRK123</TrackingNumber></Shipment>"}'
```

EDI 214 parse:

```bash
curl -s http://127.0.0.1:8000/api/parse \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{"format":"edi_214","content":"ST*214*0001~B10*REF123*TRK123*MAERSK~AT7*X3*NS***20260608*1030*LT~SE*4*0001~"}
JSON
```

EDI 856 parse:

```bash
curl -s http://127.0.0.1:8000/api/parse \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{"format":"edi_856","content":"ST*856*0002~BSN*00*SHIP123*20260608*1030~HL*1**S~SE*4*0002~"}
JSON
```

Schema inference:

```bash
curl -s http://127.0.0.1:8000/api/schema/infer \
  -H 'Content-Type: application/json' \
  -d '{"data":{"shipment":{"trackingNumber":"TRK123","pieces":2}}}'
```

Create a reusable source schema artifact:

```bash
curl -s http://127.0.0.1:8000/api/schemas \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Shipment Source",
  "direction": "source",
  "format": "json",
  "content": "{\"shipment\":{\"trackingNumber\":\"TRK123\",\"carrier\":\"MAERSK\"}}",
  "input_method": "paste"
}
JSON
```

Create a reusable target schema artifact:

```bash
curl -s http://127.0.0.1:8000/api/schemas \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Shipment Target",
  "direction": "target",
  "format": "json",
  "content": "{\"tracking\":{\"number\":\"\",\"carrierCode\":\"\"}}",
  "input_method": "paste"
}
JSON
```

List active schema artifacts:

```bash
curl -s 'http://127.0.0.1:8000/api/schemas?direction=source'
curl -s 'http://127.0.0.1:8000/api/schemas?direction=target'
```

Soft-delete a schema artifact:

```bash
curl -s -X DELETE http://127.0.0.1:8000/api/schemas/shipment-source
```

Mapping suggestions:

```bash
curl -s http://127.0.0.1:8000/api/mappings/suggest \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "source_schema": {
    "type": "object",
    "path": "$",
    "required": true,
    "fields": {
      "shipment": {
        "type": "object",
        "path": "$.shipment",
        "required": true,
        "fields": {
          "trackingNumber": {
            "type": "string",
            "path": "$.shipment.trackingNumber",
            "required": true,
            "fields": null,
            "items": null,
            "examples": ["TRK123"]
          },
          "carrier": {
            "type": "string",
            "path": "$.shipment.carrier",
            "required": true,
            "fields": null,
            "items": null,
            "examples": ["MAERSK"]
          },
          "location": {
            "type": "object",
            "path": "$.shipment.location",
            "required": true,
            "fields": {
              "city": {
                "type": "string",
                "path": "$.shipment.location.city",
                "required": true,
                "fields": null,
                "items": null,
                "examples": ["Mumbai"]
              }
            },
            "items": null,
            "examples": []
          }
        },
        "items": null,
        "examples": []
      }
    },
    "items": null,
    "examples": []
  },
  "target_schema": {
    "type": "object",
    "path": "$",
    "required": true,
    "fields": {
      "tracking": {
        "type": "object",
        "path": "$.tracking",
        "required": true,
        "fields": {
          "number": {
            "type": "string",
            "path": "$.tracking.number",
            "required": true,
            "fields": null,
            "items": null,
            "examples": [""]
          },
          "carrierCode": {
            "type": "string",
            "path": "$.tracking.carrierCode",
            "required": true,
            "fields": null,
            "items": null,
            "examples": [""]
          }
        },
        "items": null,
        "examples": []
      },
      "event": {
        "type": "object",
        "path": "$.event",
        "required": true,
        "fields": {
          "city": {
            "type": "string",
            "path": "$.event.city",
            "required": true,
            "fields": null,
            "items": null,
            "examples": [""]
          }
        },
        "items": null,
        "examples": []
      }
    },
    "items": null,
    "examples": []
  }
}
JSON
```

Typical response shape:

```json
{
  "suggestions": [
    {
      "id": "rule_001",
      "type": "field",
      "source_path": "$.shipment.trackingNumber",
      "target_path": "$.tracking.number",
      "required": true,
      "confidence": 0.57,
      "jsonata": "shipment.trackingNumber",
      "explanation": "Matched $.shipment.trackingNumber to $.tracking.number using name, synonym, path ending, and type similarity; confidence 0.57.",
      "source": "rule_based"
    }
  ],
  "used_ai": false,
  "provider_errors": []
}
```

By default the endpoint works without an OpenRouter key and returns rule-based suggestions.
To allow optional AI-assisted suggestions, set these environment variables before starting
`uvicorn`:

```bash
export OPENROUTER_API_KEY="..."
export OPENROUTER_MODEL="openai/gpt-4o-mini"
export OPENROUTER_HTTP_REFERER="http://localhost"
export OPENROUTER_APP_TITLE="Auto Mapping POC"
uvicorn app.main:app --reload
```

To force rule-based suggestions even when `OPENROUTER_API_KEY` is configured, include
`"use_ai": false` in the `/api/mappings/suggest` request body.

JSON transform:

```bash
curl -s http://127.0.0.1:8000/api/transform \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "source_data": {
    "shipment": {
      "trackingNumber": "TRK123",
      "carrier": "MAERSK",
      "eventTime": "20260608"
    }
  },
  "output_format": "json",
  "rules": [
    {
      "id": "rule_tracking",
      "type": "field",
      "source_path": "$.shipment.trackingNumber",
      "target_path": "$.tracking.number",
      "jsonata": "shipment.trackingNumber"
    },
    {
      "id": "rule_carrier",
      "type": "field",
      "source_path": "$.shipment.carrier",
      "target_path": "$.tracking.carrierCode"
    },
    {
      "id": "rule_event_date",
      "type": "date_format",
      "source_path": "$.shipment.eventTime",
      "target_path": "$.event.timestamp",
      "input_format": "%Y%m%d",
      "output_format": "%Y-%m-%d"
    }
  ]
}
JSON
```

Typical JSON transform response:

```json
{
  "output_format": "json",
  "output": {
    "tracking": {
      "number": "TRK123",
      "carrierCode": "MAERSK"
    },
    "event": {
      "timestamp": "2026-06-08"
    }
  },
  "validation_errors": []
}
```

XML transform:

```bash
curl -s http://127.0.0.1:8000/api/transform \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "source_data": {
    "shipment": {
      "trackingNumber": "TRK123",
      "carrier": "MAERSK"
    }
  },
  "output_format": "xml",
  "root_element": "ShipmentEvent",
  "rules": [
    {
      "id": "rule_tracking",
      "type": "field",
      "source_path": "$.shipment.trackingNumber",
      "target_path": "$.TrackingNumber"
    },
    {
      "id": "rule_carrier",
      "type": "field",
      "source_path": "$.shipment.carrier",
      "target_path": "$.Carrier"
    }
  ]
}
JSON
```

Typical XML transform response:

```json
{
  "output_format": "xml",
  "output": "<ShipmentEvent><TrackingNumber>TRK123</TrackingNumber><Carrier>MAERSK</Carrier></ShipmentEvent>",
  "validation_errors": []
}
```

Validation:

```bash
curl -s http://127.0.0.1:8000/api/validate \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "source_data": {
    "shipment": {
      "trackingNumber": "TRK123"
    }
  },
  "rules": [
    {
      "id": "rule_missing",
      "type": "field",
      "source_path": "$.shipment.missing",
      "target_path": "$.tracking.number"
    }
  ]
}
JSON
```

Typical validation error response:

```json
{
  "valid": false,
  "errors": [
    {
      "code": "missing_source_path",
      "path": "$.shipment.missing",
      "message": "Source path $.shipment.missing was not found.",
      "rule_id": "rule_missing"
    }
  ]
}
```

Supported deterministic Phase 3 rule types are `field`, `constant`, `concat`,
`date_format`, `condition`, and basic clean-array `loop`. JSONata is stored and
validated as editable metadata; it is not used as the execution runtime.

Schema and template storage defaults to `data/templates.sqlite3`. Override it
with `TEMPLATE_DB_PATH` when you want an isolated local store:

```bash
export TEMPLATE_DB_PATH=/tmp/automapping-templates.sqlite3
uvicorn app.main:app --reload
```

The SQLite repositories initialize tables automatically. Template access seeds
these example templates:

- `example-field`
- `example-constant`
- `example-concat`
- `example-date-format`
- `example-condition`
- `example-loop`
- `example-super`

Save template version 1:

```bash
curl -s http://127.0.0.1:8000/api/templates \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "name": "Shipment Status",
  "description": "Inbound shipment status map",
  "source_format": "json",
  "target_format": "json",
  "source_schema_snapshot": {
    "type": "object",
    "path": "$",
    "required": true,
    "fields": {
      "shipment": {
        "type": "object",
        "path": "$.shipment",
        "required": true,
        "fields": {
          "trackingNumber": {
            "type": "string",
            "path": "$.shipment.trackingNumber",
            "required": true,
            "examples": ["TRK123"]
          }
        },
        "examples": []
      }
    },
    "examples": []
  },
  "target_schema_snapshot": {
    "type": "object",
    "path": "$",
    "required": true,
    "fields": {
      "tracking": {
        "type": "object",
        "path": "$.tracking",
        "required": true,
        "fields": {
          "number": {
            "type": "string",
            "path": "$.tracking.number",
            "required": true,
            "examples": ["TRK123"]
          }
        },
        "examples": []
      }
    },
    "examples": []
  },
  "mapping_spec": {
    "engine": "deterministic_rules",
    "rules": [
      {
        "id": "rule_tracking",
        "type": "field",
        "source_path": "$.shipment.trackingNumber",
        "target_path": "$.tracking.number",
        "jsonata": "shipment.trackingNumber"
      }
    ],
    "full_jsonata_expression": "[\"shipment.trackingNumber\"]"
  },
  "validation_rules": []
}
JSON
```

List templates:

```bash
curl -s http://127.0.0.1:8000/api/templates
```

Read one template with versions:

```bash
curl -s http://127.0.0.1:8000/api/templates/shipment-status
```

Create version 2:

```bash
curl -s http://127.0.0.1:8000/api/templates/shipment-status/versions \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "source_format": "json",
  "target_format": "xml",
  "source_schema_snapshot": null,
  "target_schema_snapshot": null,
  "mapping_spec": {
    "engine": "deterministic_rules",
    "rules": [
      {
        "id": "rule_tracking_xml",
        "type": "field",
        "source_path": "$.shipment.trackingNumber",
        "target_path": "$.TrackingNumber"
      }
    ]
  },
  "validation_rules": []
}
JSON
```
