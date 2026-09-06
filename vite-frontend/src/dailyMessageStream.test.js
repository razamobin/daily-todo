import test from "node:test";
import assert from "node:assert/strict";
import { openDailyMessageStream } from "./dailyMessageStream.js";

class FakeEventSource {
    static last;
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.listeners = {};
        FakeEventSource.last = this;
    }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    close() { this.closed = true; }
    send(name, data) { this.listeners[name]({ data: JSON.stringify(data) }); }
}

function setup(t) {
    t.mock.method(globalThis, "setTimeout", () => 1);
    t.mock.method(globalThis, "clearTimeout", () => {});
    const original = globalThis.EventSource;
    globalThis.EventSource = FakeEventSource;
    t.after(() => { globalThis.EventSource = original; });
    const events = [];
    const close = openDailyMessageStream("/daily", {
        onDelta: (text) => events.push(["delta", text]),
        onEnd: (text) => events.push(["end", text]),
        onFailure: (message) => events.push(["failure", message]),
    });
    return { source: FakeEventSource.last, events, close };
}

test("stream preserves text and uses canonical saved message on completion", (t) => {
    const { source, events } = setup(t);
    source.send("delta", { text: "José\nC:\\notes" });
    source.send("end", { text: "Saved message" });
    assert.deepEqual(events, [["delta", "José\nC:\\notes"], ["end", "Saved message"]]);
    assert.equal(source.options.withCredentials, true);
    assert.equal(source.closed, true);
    source.onerror();
    assert.equal(events.length, 2);
});

test("failure closes stream and preserves actionable error", (t) => {
    const { source, events } = setup(t);
    source.send("failure", { message: "Could not save" });
    assert.deepEqual(events, [["failure", "Could not save"]]);
    assert.equal(source.closed, true);
});

test("cancelled stream cannot update another day or user", (t) => {
    const { source, events, close } = setup(t);
    close();
    source.send("delta", { text: "stale" });
    source.send("end", { text: "stale" });
    assert.deepEqual(events, []);
});

test("broken JSON and dropped connection fail cleanly", (t) => {
    const { source, events } = setup(t);
    source.listeners.delta({ data: "invalid" });
    source.onerror();
    assert.equal(events.length, 1);
    assert.equal(events[0][0], "failure");
});

test("idle timeout fails instead of leaving loading state forever", (t) => {
    const { source, events } = setup(t);
    const timeout = globalThis.setTimeout.mock.calls.at(-1).arguments[0];
    timeout();
    assert.equal(events[0][0], "failure");
    assert.equal(source.closed, true);
});
