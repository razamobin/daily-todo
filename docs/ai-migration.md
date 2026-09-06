# AI configuration and testing

The app uses the OpenAI Responses API with streamed text. Each request contains
the user's first name, mission, recent finalized history, notes and active
streaks from the Go backend. Completed messages stay in MySQL. No OpenAI
assistant, thread, conversation, dashboard prompt or tool setup is required.

## Configuration

Edit the root `.env`; Docker Compose passes it to the Python backend. Existing
installations only need to add the new settings if they want to override the
defaults. Recreate the Python container after changing them:

```bash
docker compose up -d --build python-backend
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | Required | Your OpenAI API key; must have billing and model access. |
| `OPENAI_MODEL` | `gpt-5.6-luna` | Explicit model ID. Use `gpt-5.6-terra` to evaluate a stronger alternative. |
| `OPENAI_REASONING_EFFORT` | `low` | `none`, `low`, `medium`, `high`, `xhigh`, `max`, or `omit`. `omit` excludes the parameter entirely. |
| `OPENAI_MAX_OUTPUT_TOKENS` | `4096` | Output budget including reasoning; permitted range 256–16384. |
| `OPENAI_TIMEOUT_SECONDS` | `90` | Generation deadline checked between events, plus upstream idle timeout; range 10–120 seconds. A blocked read may take up to one additional idle timeout to exit. |
| `BEARER_TOKEN` | Required | Shared Go/Python secret for fetching user context. Also salts the pseudonymous OpenAI safety identifier. |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | Redis used for generation coordination; the app also uses Redis sessions. |
| `API_BASE_URL` | `http://golang-backend:8080` | Go backend address from inside the Python container. |

Luna is the proposed inexpensive default; its encouragement quality still needs
your review. Terra is an optional quality comparison, not an automatic fallback.
Changing the model affects newly generated messages. Click **Regenerate daily
message** below a successful message to generate a replacement for the same day
using the current model settings and the latest available history. Each click
makes a new API request. The saved message is replaced only after generation and
saving succeed; failures preserve the previous message. Ordinary reloads still
reuse the saved result. Unknown model IDs are passed to OpenAI so new models can
be adopted without a code edit. Local validation checks syntax, reasoning values,
and known incompatible settings; OpenAI verifies actual account access and model
capabilities. For example, GPT-4o mini requires `OPENAI_REASONING_EFFORT=omit`,
while GPT-6 Astra does not accept `none`. We do not send temperature or top-p.

The prompt lives in `python-backend/prompts/daily_encouragement.md`. The Responses
request uses `store=false`; this disables stored Responses state, not all provider
logging or retention. API keys, notes, and full messages are not logged by the
Python AI code. Successful calls log the model, response ID, elapsed time and
input/output token counts for comparing configurations.

Official references checked September 2026:

- [Assistants migration](https://developers.openai.com/api/docs/assistants/migration)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [GPT-5.6 guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6)
- [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses)

## Local smoke test

1. Set your `.env` and run `docker compose up --build`. This rebuilds the Python
   and Go changes and serves the updated frontend. No assistant-creation curl is
   needed. Keep existing volumes and migration files.
2. Open http://localhost:3000/health. Python health validates configuration and
   connectivity to Go and Redis without calling OpenAI. It does not confirm
   billing, model access, or generation quality. The Go health result includes
   its database checks. You can also run `curl http://localhost:5001/health`.
3. Sign in, add a mission and todos, check off items and finalize a day. Verify
   the message appears incrementally and completes without an error.
4. Reload. Verify the same saved text appears and the Python logs contain no
   additional `AI complete` entry for that reload.
5. If two tabs request an unsaved day's message at once, one may show an
   “already being generated” message. Retry after the first finishes; the second
   tab should retrieve the saved text. A Redis lease coordinates workers, and a
   database transaction makes repeated saves return the original message.
6. On a day with no saved message, try an invalid model ID or API key, recreate
   the Python container, and confirm an actionable error appears. Restore your
   settings and retry. Use a test account for these checks.

Generation failures, refusal, truncated output, lost leases, and save failures
never emit a successful completion. Partial output is cleared when the frontend
receives an error. Browser disconnects close the upstream stream and release the
lease. A worker crash leaves a bounded lease that expires automatically. Retrying
an interrupted or unsaved generation can incur a new API charge; no automatic
provider retries or model fallback occur.

Inspect errors and usage with:

```bash
docker compose logs --tail=100 python-backend golang-backend
```

## Automated checks (no OpenAI requests)

```bash
docker compose run --rm --no-deps python-backend python -m unittest discover -p 'test_*.py' -v
docker compose run --rm --no-deps golang-backend go test ./...
```

Frontend checks with Node 22 or newer:

```bash
cd vite-frontend
npm ci
npm test
npm run build
```

Python tests use the real pinned SDK with a simulated HTTP transport to verify
request parameters and SSE parsing. Additional tests cover authentication,
configuration, cached messages, coordination, interrupted streams, and failed
saves. Go tests cover transaction ordering, repeat saves and rollback. Frontend
tests cover text encoding, errors, timeout and stale stream cancellation.

## Optional model comparison (makes paid API calls)

Run the three synthetic histories through the configured model without touching
your database:

```bash
docker compose run --rm --no-deps python-backend python evaluate_ai.py
docker compose run --rm --no-deps -e OPENAI_MODEL=gpt-5.6-terra python-backend python evaluate_ai.py
```

Each command makes three live requests. Review whether all supplied streaks are
mentioned with the correct lengths, whether notes and missions are reflected,
whether unsupported achievements are invented, and whether the tone feels useful.
The script prints each response and logs elapsed time and token usage. Compare
the same cases on both models; choose the least expensive configuration that
meets your quality and latency expectations. Automated mocked tests cannot
establish actual model quality or account access.
