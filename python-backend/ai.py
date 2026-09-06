"""Provider configuration and Responses streaming, independent of Flask."""
from dataclasses import dataclass
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
import time

from openai import OpenAI

PROMPT = (Path(__file__).parent / "prompts" / "daily_encouragement.md").read_text()
logger = logging.getLogger(__name__)


class ConfigError(ValueError):
    pass


class GenerationError(Exception):
    pass


@dataclass(frozen=True)
class AIConfig:
    api_key: str
    model: str
    reasoning_effort: str
    max_output_tokens: int
    timeout_seconds: int

    @classmethod
    def from_env(cls):
        key = os.getenv("OPENAI_API_KEY", "").strip()
        if not key or key == "sk-proj-123":
            raise ConfigError("Set OPENAI_API_KEY to your API key.")
        model = os.getenv("OPENAI_MODEL", "gpt-5.6-luna").strip()
        if not model or any(c.isspace() for c in model):
            raise ConfigError("OPENAI_MODEL must be a model ID without whitespace.")
        effort = os.getenv("OPENAI_REASONING_EFFORT", "low").strip().lower()
        if effort not in {"omit", "none", "low", "medium", "high", "xhigh", "max"}:
            raise ConfigError("OPENAI_REASONING_EFFORT must be omit, none, low, medium, high, xhigh, or max.")
        if model.startswith("gpt-6-astra") and effort == "none":
            raise ConfigError("GPT-6 Astra requires reasoning; use low or higher.")
        if model.startswith(("gpt-4", "gpt-3")) and effort != "omit":
            raise ConfigError("For non-reasoning models, set OPENAI_REASONING_EFFORT=omit.")
        try:
            tokens = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "4096"))
            timeout = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "90"))
        except ValueError as exc:
            raise ConfigError("AI output token and timeout settings must be integers.") from exc
        if not 256 <= tokens <= 16384:
            raise ConfigError("OPENAI_MAX_OUTPUT_TOKENS must be between 256 and 16384.")
        if not 10 <= timeout <= 120:
            raise ConfigError("OPENAI_TIMEOUT_SECONDS must be between 10 and 120.")
        return cls(key, model, effort, tokens, timeout)


def stream_encouragement(config, first_name, history, user_id):
    params = {
        "model": config.model,
        "instructions": PROMPT,
        "input": json.dumps({"first_name": first_name, "history": history}, ensure_ascii=False),
        "max_output_tokens": config.max_output_tokens,
        "store": False,
        "safety_identifier": hmac.new(os.environ.get("BEARER_TOKEN", "").encode(),
                                      str(user_id).encode(), hashlib.sha256).hexdigest(),
    }
    if config.reasoning_effort != "omit":
        params["reasoning"] = {"effort": config.reasoning_effort}
    started = time.monotonic()
    # Never retry a partially emitted generation automatically.
    with OpenAI(api_key=config.api_key, timeout=config.timeout_seconds, max_retries=0) as client:
        with client.responses.stream(**params) as stream:
            for event in stream:
                if time.monotonic() - started > config.timeout_seconds:
                    raise GenerationError("AI generation took too long. Please retry.")
                if event.type == "response.output_text.delta":
                    yield "delta", {"text": event.delta}
                elif event.type in {"response.failed", "response.incomplete", "error"}:
                    raise GenerationError("The AI did not finish the message. Please retry; if it repeats, check the output token limit and model settings.")
                elif event.type in {"response.refusal.delta", "response.refusal.done"}:
                    raise GenerationError("The AI could not generate encouragement for this request.")
                else:
                    yield "heartbeat", {}
            final = stream.get_final_response()
            if final.status != "completed" or not final.output_text.strip():
                raise GenerationError("The AI returned no complete message. Please retry.")
            usage = final.usage
            logger.info("AI complete model=%s response_id=%s seconds=%.2f input_tokens=%s output_tokens=%s",
                        config.model, final.id, time.monotonic() - started,
                        usage.input_tokens if usage else None, usage.output_tokens if usage else None)
            yield "complete", {"text": final.output_text}
