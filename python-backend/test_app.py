import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

import httpx2
import openai
import redis

import ai
import app as backend


def response(status=200, **data):
    return SimpleNamespace(status_code=status, json=lambda: data)


def frames(result):
    return [(frame.splitlines()[0][7:], json.loads(frame.splitlines()[1][6:]))
            for frame in result.get_data(as_text=True).strip().split("\n\n")]


class AppTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"OPENAI_API_KEY": "test-key", "BEARER_TOKEN": "test-secret"}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        backend.app.config["TESTING"] = True
        self.client = backend.app.test_client()
        self.client.set_cookie("session_id", "session-test")
        self.saved = None
        self.saves = []
        self.save_status = 200
        self.cached_reads = 0
        self.forward = patch.object(backend, "forward_request_with_session_cookie", side_effect=self.request)
        self.forward_mock = self.forward.start()
        self.addCleanup(self.forward.stop)
        self.history_patch = patch.object(backend.requests, "get", return_value=response(mission="Be consistent", active_streaks=[]))
        self.history_patch.start()
        self.addCleanup(self.history_patch.stop)
        self.redis_patch = patch.object(backend, "redis_client")
        self.redis_mock = self.redis_patch.start()
        self.addCleanup(self.redis_patch.stop)
        self.lock = self.redis_mock.return_value.lock.return_value
        self.lock.acquire.return_value = True
        self.ai_patch = patch.object(backend, "stream_encouragement", side_effect=self.generation)
        self.ai_mock = self.ai_patch.start()
        self.addCleanup(self.ai_patch.stop)

    def generation(self, *args):
        yield "delta", {"text": "Hello José\n"}
        yield "delta", {"text": r"Keep your C:\notes habit."}
        yield "complete", {"text": "Hello José\n" + r"Keep your C:\notes habit."}

    def request(self, path, method="GET", json=None):
        if path == "/api/logged-in-user":
            return response(loggedIn=True, user={"id": 7})
        if path.startswith("/api/get-saved"):
            self.cached_reads += 1
            return response(message=self.saved) if self.saved else response(404)
        if path == "/api/user-first-name":
            return response(first_name="José")
        if path == "/api/save-assistant-message":
            self.saves.append(json)
            if self.save_status == 200:
                self.saved = json["message"]
            return response(self.save_status, message=self.saved)
        raise AssertionError(path)

    def get_message(self):
        return self.client.get("/api/daily-message?new_day_number=3&user_id=999", buffered=True)

    def test_success_stream_save_and_cached_reload(self):
        result = self.get_message()
        events = frames(result)
        self.assertEqual([e[0] for e in events], ["delta", "delta", "end"])
        self.assertEqual(events[-1][1]["text"], self.saved)
        self.assertEqual(events[0][1]["text"], "Hello José\n")
        self.assertEqual(len(self.saves), 1)
        self.assertEqual(self.ai_mock.call_args.args[-1], 7)  # Session owns identity.
        self.lock.release.assert_called_once()
        cached = frames(self.get_message())
        self.assertTrue(cached[-1][1]["cached"])
        self.ai_mock.assert_called_once()

    def test_cache_works_without_api_key_or_redis(self):
        os.environ.pop("OPENAI_API_KEY")
        self.saved = "An existing message"
        self.assertEqual(frames(self.get_message())[-1][0], "end")
        self.redis_mock.assert_not_called()
        self.ai_mock.assert_not_called()

    def test_regeneration_bypasses_cache_and_saves_replacement(self):
        self.saved = "Original message"
        events = frames(self.client.get("/api/daily-message?new_day_number=3&regenerate=1", buffered=True))
        self.ai_mock.assert_called_once()
        self.assertTrue(self.saves[0]["replace"])
        self.assertEqual(self.saves[0]["day_number"], 3)
        self.assertFalse(events[-1][1]["cached"])
        self.assertNotEqual(self.saved, "Original message")
        self.assertTrue(frames(self.get_message())[-1][1]["cached"])
        self.ai_mock.assert_called_once()

    def test_failed_regeneration_preserves_previous_message(self):
        self.saved = "Original message"
        self.save_status = 500
        events = frames(self.client.get("/api/daily-message?new_day_number=3&regenerate=1", buffered=True))
        self.assertEqual(events[-1][0], "failure")
        self.assertEqual(self.saved, "Original message")

    def test_regeneration_uses_same_coordination_lock(self):
        self.saved = "Original message"
        self.lock.acquire.return_value = False
        events = frames(self.client.get("/api/daily-message?new_day_number=3&regenerate=1", buffered=True))
        self.assertEqual(events[-1][0], "failure")
        self.ai_mock.assert_not_called()
        self.assertEqual(self.saved, "Original message")

    def test_missing_key_fails_before_generation(self):
        os.environ.pop("OPENAI_API_KEY")
        self.assertIn("OPENAI_API_KEY", frames(self.get_message())[-1][1]["message"])
        self.ai_mock.assert_not_called()

    def test_concurrent_generation_does_not_call_openai(self):
        self.lock.acquire.return_value = False
        self.assertIn("already being generated", frames(self.get_message())[-1][1]["message"])
        self.ai_mock.assert_not_called()
        self.lock.release.assert_not_called()

    def test_second_cache_check_avoids_generation_race(self):
        original = self.request
        def raced(path, **kwargs):
            if path.startswith("/api/get-saved") and self.cached_reads == 1:
                self.saved = "Other worker finished"
            return original(path, **kwargs)
        self.forward_mock.side_effect = raced
        self.assertTrue(frames(self.get_message())[-1][1]["cached"])
        self.ai_mock.assert_not_called()
        self.lock.release.assert_called_once()

    def test_failed_save_never_reports_success(self):
        self.save_status = 500
        events = frames(self.get_message())
        self.assertEqual(events[-1][0], "failure")
        self.assertNotIn("end", [event[0] for event in events])
        self.assertIsNone(self.saved)
        self.lock.release.assert_called_once()

    def test_interrupted_generation_is_not_saved(self):
        def broken(*args):
            yield "delta", {"text": "partial"}
            raise ai.GenerationError("Interrupted")
        self.ai_mock.side_effect = broken
        self.assertEqual(frames(self.get_message())[-1][0], "failure")
        self.assertEqual(self.saves, [])
        self.lock.release.assert_called_once()

    def test_disconnect_releases_lock_without_saving(self):
        closed = []
        def generation(*args):
            try:
                yield "delta", {"text": "partial"}
            finally:
                closed.append(True)
        self.ai_mock.side_effect = generation
        with backend.app.test_request_context("/", headers={"Cookie": "session_id=test"}):
            stream = backend.daily_events(7, 3)
            self.assertIn("delta", next(stream))
            stream.close()
        self.lock.release.assert_called_once()
        self.assertEqual(self.saves, [])
        self.assertEqual(closed, [True])

    def test_lost_lease_does_not_save(self):
        self.lock.extend.side_effect = redis.exceptions.LockNotOwnedError("expired")
        self.assertEqual(frames(self.get_message())[-1][0], "failure")
        self.assertEqual(self.saves, [])

    def test_provider_errors_are_actionable_without_leaking_secrets(self):
        req = httpx2.Request("POST", "https://api.openai.com/v1/responses")
        for error, expected in [
            (openai.AuthenticationError("private", response=httpx2.Response(401, request=req), body=None), "API key"),
            (openai.RateLimitError("private", response=httpx2.Response(429, request=req), body=None), "quota"),
            (openai.BadRequestError("private", response=httpx2.Response(400, request=req), body=None), "settings"),
            (openai.APITimeoutError(request=req), "timed out"),
        ]:
            with self.subTest(error=type(error).__name__):
                self.ai_mock.side_effect = error
                events = frames(self.get_message())
                self.assertEqual(events[-1][0], "failure")
                self.assertIn(expected, events[-1][1]["message"])
                self.assertNotIn("private", events[-1][1]["message"])
                self.assertEqual(self.saves, [])

    def test_requires_authentication_and_valid_day(self):
        for day in ["", "-1", "abc", "1.5"]:
            self.assertEqual(self.client.get(f"/api/daily-message?new_day_number={day}").status_code, 400)
        self.forward_mock.side_effect = lambda *a, **k: response(loggedIn=False)
        self.assertEqual(self.get_message().status_code, 401)
        self.ai_mock.assert_not_called()

    def test_stream_billing_error_explains_failure_and_does_not_save(self):
        self.ai_mock.side_effect = openai.APIError(
            "Private provider details", request=httpx2.Request("POST", "https://api.openai.com/v1/responses"),
            body={"code": "billing_not_active", "message": "Private provider details"})
        events = frames(self.get_message())
        self.assertEqual(events[-1][0], "failure")
        self.assertIn("billing is not active", events[-1][1]["message"])
        self.assertNotIn("Private", events[-1][1]["message"])
        self.assertEqual(self.saves, [])
        self.lock.release.assert_called_once()

    def test_retired_setup_and_health_do_not_call_openai(self):
        self.assertEqual(self.client.post("/api/create-assistant").status_code, 410)
        result = self.client.get("/health")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["ai"]["status"], "configured")
        self.assertNotIn("test-key", result.get_data(as_text=True))
        self.ai_mock.assert_not_called()


class ConfigurationTests(unittest.TestCase):
    def test_configuration_validation(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test"}, clear=True):
            self.assertEqual(ai.AIConfig.from_env().model, "gpt-5.6-luna")
            for name, value in [("OPENAI_REASONING_EFFORT", "ultra"),
                                ("OPENAI_TIMEOUT_SECONDS", "0"),
                                ("OPENAI_MAX_OUTPUT_TOKENS", "word"),
                                ("OPENAI_MODEL", "")]:
                with self.subTest(name=name), patch.dict(os.environ, {name: value}):
                    with self.assertRaises(ai.ConfigError):
                        ai.AIConfig.from_env()
            with patch.dict(os.environ, {"OPENAI_MODEL": "gpt-4o-mini"}):
                with self.assertRaises(ai.ConfigError):
                    ai.AIConfig.from_env()
                with patch.dict(os.environ, {"OPENAI_REASONING_EFFORT": "omit"}):
                    self.assertEqual(ai.AIConfig.from_env().reasoning_effort, "omit")


class SDKTests(unittest.TestCase):
    """Exercise the pinned SDK's real request serialization and SSE parser offline."""
    def events(self, status="completed"):
        initial = {"id": "resp_test", "object": "response", "created_at": 0,
                   "model": "gpt-5.6-luna", "status": "in_progress", "output": [],
                   "parallel_tool_calls": False, "tool_choice": "auto", "tools": []}
        item = {"id": "msg_test", "type": "message", "role": "assistant",
                "status": "in_progress", "content": []}
        part = {"type": "output_text", "text": "", "annotations": [], "logprobs": []}
        text = "Keep going, José!"
        final_item = {**item, "status": "completed", "content": [{**part, "text": text}]}
        return [
            {"type": "response.created", "response": initial},
            {"type": "response.output_item.added", "output_index": 0, "item": item},
            {"type": "response.content_part.added", "output_index": 0, "content_index": 0, "item_id": "msg_test", "part": part},
            {"type": "response.output_text.delta", "output_index": 0, "content_index": 0, "item_id": "msg_test", "delta": text},
            {"type": "response.output_item.done", "output_index": 0, "item": final_item},
            {"type": f"response.{status}", "response": {**initial, "status": status, "output": [final_item], "usage": None}},
        ]

    def run_sdk(self, events, effort="low"):
        captured = []
        def transport(request):
            captured.append(json.loads(request.content))
            body = "".join(f'event: {event["type"]}\ndata: {json.dumps({**event, "sequence_number": i})}\n\n'
                           for i, event in enumerate(events))
            return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=body)
        real_client = openai.OpenAI(api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(transport)))
        config = ai.AIConfig("test", "gpt-5.6-luna", effort, 4096, 90)
        with patch.object(ai, "OpenAI", return_value=real_client):
            output = list(ai.stream_encouragement(config, "José", {"notes": "data"}, 7))
        return output, captured

    def test_real_sdk_request_and_stream_contract(self):
        output, captured = self.run_sdk(self.events())
        self.assertEqual(output[-1], ("complete", {"text": "Keep going, José!"}))
        self.assertEqual(captured[0]["reasoning"], {"effort": "low"})
        self.assertFalse(captured[0]["store"])
        self.assertEqual(captured[0]["model"], "gpt-5.6-luna")
        self.assertIn("data", captured[0]["input"])
        _, captured = self.run_sdk(self.events(), effort="omit")
        self.assertNotIn("reasoning", captured[0])

    def test_incomplete_and_failed_output_never_completes(self):
        for status in ["incomplete", "failed"]:
            with self.subTest(status=status), self.assertRaises(ai.GenerationError):
                self.run_sdk(self.events(status))

    def test_missing_terminal_event_never_completes(self):
        with self.assertRaises(Exception):
            self.run_sdk(self.events()[:-1])

    def test_http_200_can_raise_sdk_billing_error_midstream(self):
        events = self.events()[:1] + [{
            "type": "error", "error": {
                "code": "billing_not_active", "param": None,
                "message": "Your account is not active, please check your billing details.",
            },
        }]
        with self.assertRaises(openai.APIError) as raised:
            self.run_sdk(events)
        self.assertEqual(raised.exception.code, "billing_not_active")


if __name__ == "__main__":
    unittest.main()
