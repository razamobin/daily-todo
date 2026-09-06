"""Daily encouragement via Responses; MySQL remains the message history."""
from contextlib import closing
import json
import logging
import os
import re
import time

from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS
import openai
import redis
import requests

from ai import AIConfig, ConfigError, GenerationError, stream_encouragement

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
CORS(app, origins=[
    "http://localhost:3000",
    "http://app-backend-lb-330001835.us-west-2.elb.amazonaws.com",
    "https://dailytodos.ai", "https://www.dailytodos.ai",
    "https://api1.dailytodos.ai", "https://api2.dailytodos.ai",
], supports_credentials=True)
API_BASE_URL = os.getenv("API_BASE_URL", "http://golang-backend:8080")


class ServiceError(Exception):
    pass


def redis_client():
    return redis.Redis(host=os.getenv("REDIS_HOST", "redis"),
                       port=int(os.getenv("REDIS_PORT", "6379")),
                       socket_connect_timeout=5, socket_timeout=5)


def forward_request_with_session_cookie(path, method="GET", json=None):
    headers = {}
    if request.cookies.get("session_id"):
        headers["Cookie"] = f"session_id={request.cookies['session_id']}"
    return requests.request(method, f"{API_BASE_URL}{path}", headers=headers,
                            json=json, timeout=10)


def clean_markdown(message):
    message = re.sub(r"^```markdown\s*", "", message)
    return re.sub(r"\s*```$", "", message)


def sse(event, payload):
    # JSON preserves literal backslashes, newlines and Unicode across SSE frames.
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def saved_message(day):
    response = forward_request_with_session_cookie(
        f"/api/get-saved-assistant-message?day_number={day}")
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise ServiceError("Could not load the saved daily message. Please retry.")
    return response.json().get("message")


def cached_events(message):
    message = clean_markdown(message)
    yield sse("delta", {"text": message})
    yield sse("end", {"text": message, "cached": True})


def daily_events(user_id, day, regenerate=False):
    lock = None
    acquired = False
    try:
        cached = saved_message(day)
        if cached and not regenerate:
            yield from cached_events(cached)
            return
        config = AIConfig.from_env()
        # Shared across workers. Lease exceeds upstream idle and save timeouts.
        lease = config.timeout_seconds * 2 + 60
        lock = redis_client().lock(f"daily-message:{user_id}:{day}", timeout=lease,
                                   blocking=False, thread_local=False)
        acquired = lock.acquire()
        if not acquired:
            raise ServiceError("This day's message is already being generated. Retry shortly.")
        cached = saved_message(day)
        if cached and not regenerate:
            yield from cached_events(cached)
            return
        profile = forward_request_with_session_cookie("/api/user-first-name")
        if profile.status_code != 200:
            raise ServiceError("Could not load your profile. Please retry.")
        first_name = profile.json().get("first_name")
        if not first_name:
            raise ServiceError("Please set your first name in your profile.")
        token = os.getenv("BEARER_TOKEN", "")
        if not token:
            raise ConfigError("BEARER_TOKEN is not configured.")
        history = requests.get(f"{API_BASE_URL}/api/user-mission",
                               params={"user_id": user_id},
                               headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if history.status_code != 200:
            raise ServiceError("Could not load your mission and history. Please retry.")
        renewed = time.monotonic()
        final_text = None
        with closing(stream_encouragement(config, first_name, history.json(), user_id)) as generation:
            for event, payload in generation:
                if time.monotonic() - renewed > lease / 3:
                    lock.extend(lease, replace_ttl=True)
                    renewed = time.monotonic()
                if event == "complete":
                    final_text = clean_markdown(payload["text"])
                else:
                    yield sse(event, payload)
        if not final_text:
            raise GenerationError("The AI returned no complete message. Please retry.")
        lock.extend(lease, replace_ttl=True)
        result = forward_request_with_session_cookie(
            "/api/save-assistant-message", method="POST",
            json={"day_number": day, "message": final_text, "replace": regenerate})
        if result.status_code != 200:
            raise ServiceError("Your message could not be saved. Please retry.")
        # The save endpoint returns the canonical text if already saved.
        yield sse("end", {"text": result.json()["message"], "cached": False})
    except (ConfigError, GenerationError, ServiceError) as exc:
        yield sse("failure", {"message": str(exc)})
    except openai.AuthenticationError:
        yield sse("failure", {"message": "The OpenAI API key was rejected. Check OPENAI_API_KEY."})
    except openai.RateLimitError:
        yield sse("failure", {"message": "OpenAI quota or rate limit reached. Check billing and retry later."})
    except (openai.BadRequestError, openai.NotFoundError, openai.PermissionDeniedError) as exc:
        app.logger.warning("OpenAI rejected configuration: status=%s request_id=%s",
                           exc.status_code, exc.request_id)
        yield sse("failure", {"message": "OpenAI rejected the model or request settings. Check model access and AI configuration."})
    except (openai.APITimeoutError, openai.APIConnectionError):
        yield sse("failure", {"message": "OpenAI could not be reached or timed out. Please retry."})
    except openai.APIError as exc:
        # HTTP 200 can still carry an SSE error. The SDK raises APIError
        # before our event loop sees it, rather than an HTTP status subclass.
        messages = {
            "billing_not_active": "OpenAI API billing is not active. Check billing for the account/project that owns OPENAI_API_KEY, then retry.",
            "insufficient_quota": "OpenAI API quota is exhausted. Check your API credits and spending limits, then retry.",
            "rate_limit_exceeded": "OpenAI rate limit reached. Please retry shortly.",
            "model_not_found": "The selected OpenAI model is unavailable. Check OPENAI_MODEL and your project's model access.",
            "invalid_api_key": "The OpenAI API key was rejected. Check OPENAI_API_KEY.",
        }
        code = exc.code if exc.code in messages else "unknown"
        app.logger.warning("OpenAI stream/request failed: code=%s", code)
        yield sse("failure", {"message": messages.get(code, "OpenAI could not complete the request. Please retry shortly.")})
    except redis.RedisError:
        yield sse("failure", {"message": "The message coordination service is unavailable. Please retry shortly."})
    except requests.RequestException:
        yield sse("failure", {"message": "The app backend could not be reached. Please retry."})
    except Exception as exc:
        # Avoid logging prompts, notes, credentials or raw provider error bodies.
        app.logger.error("Daily message failed: %s", type(exc).__name__)
        yield sse("failure", {"message": "The daily message could not be completed. Please retry."})
    finally:
        if acquired:
            try:
                lock.release()
            except redis.RedisError:
                app.logger.warning("Daily message lease was lost or could not be released")


@app.route("/")
def home():
    return jsonify(message="Daily Todos Python backend")


@app.route("/api/daily-message")
def daily_message():
    try:
        response = forward_request_with_session_cookie("/api/logged-in-user")
        if response.status_code != 200:
            return jsonify(error="Could not authenticate user"), response.status_code
        data = response.json()
        if not data.get("loggedIn") or not data.get("user", {}).get("id"):
            return jsonify(error="Please sign in"), 401
        day = int(request.args.get("new_day_number", ""))
        if day < 0:
            raise ValueError()
    except ValueError:
        return jsonify(error="new_day_number must be a nonnegative integer"), 400
    except requests.RequestException:
        return jsonify(error="App backend unavailable"), 503
    return Response(stream_with_context(daily_events(data["user"]["id"], day, request.args.get("regenerate") == "1")),
                    mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@app.route("/api/create-assistant", methods=["POST"])
def create_assistant():
    return jsonify(message="Assistant provisioning is no longer needed. Configure OPENAI_API_KEY and OPENAI_MODEL, then use the app."), 410


@app.route("/lbhealth")
def lb_health_check():
    return "healthy", 200


@app.route("/health")
def health_check():
    status = {}
    try:
        config = AIConfig.from_env()
        status["ai"] = {"status": "configured", "model": config.model,
                        "reasoning_effort": config.reasoning_effort,
                        "note": "Configuration only; model access and billing require a live generation."}
    except ConfigError as exc:
        status["ai"] = {"status": "unhealthy", "error": str(exc)}
    try:
        result = requests.get(f"{API_BASE_URL}/lbhealth", timeout=5)
        status["golang_backend"] = "healthy" if result.status_code == 200 else "unhealthy"
    except requests.RequestException:
        status["golang_backend"] = "unhealthy"
    try:
        redis_client().ping()
        status["redis"] = "healthy"
    except (redis.RedisError, ValueError):
        status["redis"] = "unhealthy"
    status["bearer_token"] = "configured" if os.getenv("BEARER_TOKEN") else "missing"
    healthy = (status["ai"]["status"] == "configured"
               and status["golang_backend"] == "healthy" and status["redis"] == "healthy"
               and status["bearer_token"] == "configured")
    return jsonify(status), 200 if healthy else 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
