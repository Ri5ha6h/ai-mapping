# Auto Mapping Backend

FastAPI backend for the Auto Mapping POC.

The mapping model is intentionally simple: every template stores one JavaScript transform
function.

```js
function transform(source, helpers) {
  return {
    tracking: {
      number: helpers.get(source, "$.shipment.trackingNumber", "")
    }
  };
}
```

## Runtime

- Source files are parsed into canonical JSON.
- The transform function receives `source` and `helpers`.
- Scripts run synchronously in a PyMiniRacer/V8 sandbox.
- Scripts cannot use imports, filesystem, process globals, network globals, or async results.
- Output must be JSON-serializable.
- Validation checks script presence and output shape against the target schema.

## Main APIs

- `POST /api/parse`
- `POST /api/schema/infer`
- `POST /api/mappings/suggest`
- `POST /api/mappings/script/draft`
- `POST /api/transform`
- `POST /api/validate`
- `POST /api/transform/diff`
- `POST /api/templates`
- `GET /api/templates`
- `GET /api/templates/{template_id}`
- `POST /api/templates/{template_id}/versions`

## Mapping Spec

```json
{
  "engine": "script_js",
  "script_version": 1,
  "script": "function transform(source, helpers) { return {}; }"
}
```

## Helpers

- `helpers.get(value, path, fallback)`
- `helpers.default(value, fallback)`
- `helpers.clean(value)`
- `helpers.regexReplace(value, pattern, replacement, flags)`
- `helpers.parseNumber(value, fallback)`
- `helpers.formatDate(value, inputFormat, outputFormat)`
- `helpers.lookup(table, key, fallback)`
- `helpers.countryCode(value, fallback)`
- `helpers.omitEmpty(value)`

## Verification

```bash
backend/.venv/bin/python -m ruff check backend
cd backend && .venv/bin/python -m pyright
backend/.venv/bin/python -m pytest backend/tests -q
```
