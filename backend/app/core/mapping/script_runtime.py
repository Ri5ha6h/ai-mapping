import json
import re
from dataclasses import dataclass
from typing import Any

from py_mini_racer import JSEvalException, JSParseException, JSTimeoutException, MiniRacer

from app.api.models import ScriptLogItem, TransformTraceItem, ValidationErrorItem

SCRIPT_TIMEOUT_MS = 1000
MAX_OUTPUT_BYTES = 2_000_000
MAX_LOGS = 100
MAX_LOG_MESSAGE_LENGTH = 2_000


@dataclass(frozen=True)
class ScriptResult:
    output: Any
    errors: list[ValidationErrorItem]
    trace: list[TransformTraceItem]
    logs: list[ScriptLogItem]


def execute_script_transform(source_data: Any, script: str) -> ScriptResult:
    if not script.strip():
        return ScriptResult(
            output={},
            errors=[
                ValidationErrorItem(
                    code="missing_script",
                    message="Transform function is required.",
                    rule_id="script",
            )
            ],
            trace=[],
            logs=[],
        )

    ctx = MiniRacer()
    try:
        result_json = ctx.eval(
            _execution_source(source_data, script),
            timeout=SCRIPT_TIMEOUT_MS,
        )
    except JSTimeoutException:
        return _failed("script_timeout", "Transform function exceeded the execution limit.")
    except (JSEvalException, JSParseException, ValueError) as exc:
        return _failed("script_execution_failed", _clean_js_error(str(exc)))
    finally:
        ctx.close()

    if not isinstance(result_json, str):
        return _failed("invalid_script_output", "Transform function did not return JSON output.")
    if len(result_json.encode("utf-8")) > MAX_OUTPUT_BYTES:
        return _failed("script_output_too_large", "Transform output exceeded the size limit.")

    try:
        envelope = json.loads(result_json)
    except json.JSONDecodeError as exc:
        return _failed("invalid_script_output", f"Transform output was not valid JSON: {exc}")
    if not isinstance(envelope, dict) or "output" not in envelope:
        return _failed("invalid_script_output", "Transform output was not valid JSON.")

    return ScriptResult(
        output=envelope["output"],
        errors=[],
        trace=[
            TransformTraceItem(
                step_id="transform",
                step_type="script",
                status="executed",
                message="Transform function executed.",
            )
        ],
        logs=_parse_logs(envelope.get("logs")),
    )


def _execution_source(source_data: Any, script: str) -> str:
    source_json = json.dumps(source_data)
    return f"""
"use strict";
globalThis.process = undefined;
globalThis.require = undefined;
globalThis.fetch = undefined;
globalThis.XMLHttpRequest = undefined;
globalThis.WebSocket = undefined;
globalThis.importScripts = undefined;
globalThis.eval = undefined;
globalThis.Function = undefined;

const __logs = [];
function __captureLog(level, args) {{
  if (__logs.length >= {MAX_LOGS}) return;
  const message = Array.from(args).map((item) => {{
    if (typeof item === "string") return item;
    if (item === undefined) return "undefined";
    try {{
      return JSON.stringify(item);
    }} catch (_error) {{
      return String(item);
    }}
  }}).join(" ");
  __logs.push({{
    level,
    message: message.length > {MAX_LOG_MESSAGE_LENGTH}
      ? `${{message.slice(0, {MAX_LOG_MESSAGE_LENGTH})}}...`
      : message,
    index: __logs.length
  }});
}}
globalThis.console = Object.freeze({{
  log(...args) {{ __captureLog("log", args); }},
  info(...args) {{ __captureLog("info", args); }},
  warn(...args) {{ __captureLog("warn", args); }},
  error(...args) {{ __captureLog("error", args); }}
}});

const source = JSON.parse({json.dumps(source_json)});
const helpers = Object.freeze({{
  get(value, path, fallback = undefined) {{
    if (!path || path === "$") return value === undefined ? fallback : value;
    const parts = String(path)
      .replace(/^\\$\\.?/, "")
      .replace(/\\[(\\d+)\\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    let current = value;
    for (const part of parts) {{
      if (current === null || current === undefined || !(part in Object(current))) {{
        return fallback;
      }}
      current = current[part];
    }}
    return current === undefined ? fallback : current;
  }},
  default(value, fallback = "") {{
    return value === null || value === undefined || value === "" ? fallback : value;
  }},
  clean(value) {{
    return String(value ?? "").replace(/\\s+/g, "").trim();
  }},
  regexReplace(value, pattern, replacement = "", flags = "g") {{
    return String(value ?? "").replace(new RegExp(pattern, flags), replacement);
  }},
  parseNumber(value, fallback = 0) {{
    if (typeof value === "number") return value;
    const text = String(value ?? "").replace(/[^0-9.\\-]/g, "");
    if (!text) return fallback;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : fallback;
  }},
  formatDate(value, inputFormat = "YYYYMMDD", outputFormat = "YYYY-MM-DD") {{
    const text = String(value ?? "");
    if (inputFormat === "YYYYMMDD" && /^\\d{{8}}$/.test(text)) {{
      const yyyy = text.slice(0, 4);
      const mm = text.slice(4, 6);
      const dd = text.slice(6, 8);
      if (outputFormat === "YYYY-MM-DD") return `${{yyyy}}-${{mm}}-${{dd}}`;
    }}
    return text;
  }},
  lookup(table, key, fallback = "") {{
    return Object.prototype.hasOwnProperty.call(table ?? {{}}, String(key))
      ? table[String(key)]
      : fallback;
  }},
  countryCode(value, fallback = "") {{
    const table = {{
      USA: "US", CAN: "CA", MEX: "MX", GBR: "GB", DEU: "DE", FRA: "FR",
      IND: "IN", CHN: "CN", JPN: "JP", SGP: "SG", NLD: "NL"
    }};
    const text = String(value ?? "").trim().toUpperCase();
    return table[text] ?? (text.length === 2 ? text : fallback);
  }},
  omitEmpty(value) {{
    if (Array.isArray(value)) {{
      return value.filter((item) => item !== null && item !== undefined && item !== "");
    }}
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([, item]) => (
      item !== null &&
      item !== undefined &&
      item !== "" &&
      !(Array.isArray(item) && item.length === 0)
    )));
  }}
}});

{script}

if (typeof transform !== "function") {{
  throw new Error("Script must define function transform(source, helpers).");
}}
const result = transform(source, helpers);
if (result && typeof result.then === "function") {{
  throw new Error("Async transform functions are not supported.");
}}
JSON.stringify({{ output: result, logs: __logs }});
"""


def _failed(code: str, message: str) -> ScriptResult:
    return ScriptResult(
        output={},
        errors=[ValidationErrorItem(code=code, message=message, rule_id="script")],
        trace=[
            TransformTraceItem(
                step_id="transform",
                step_type="script",
                status="failed",
                message=message,
            )
        ],
        logs=[],
    )


def _clean_js_error(message: str) -> str:
    return re.sub(r"\s+at <anonymous>.*", "", message, flags=re.DOTALL).strip()


def _parse_logs(raw_logs: Any) -> list[ScriptLogItem]:
    if not isinstance(raw_logs, list):
        return []
    logs: list[ScriptLogItem] = []
    for index, raw_log in enumerate(raw_logs[:MAX_LOGS]):
        if not isinstance(raw_log, dict):
            continue
        level = raw_log.get("level")
        if level not in {"log", "info", "warn", "error"}:
            level = "log"
        message = str(raw_log.get("message", ""))
        logs.append(
            ScriptLogItem(
                level=level,
                message=message[:MAX_LOG_MESSAGE_LENGTH],
                index=int(raw_log.get("index", index)),
            )
        )
    return logs
