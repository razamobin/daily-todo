// The backend sends JSON SSE events: delta, heartbeat, end, and failure.
export function openDailyMessageStream(url, { onDelta, onEnd, onFailure }) {
    const source = new EventSource(url, { withCredentials: true });
    let closed = false;
    let timer;
    const close = () => {
        closed = true;
        clearTimeout(timer);
        source.close();
    };
    const fail = (message) => {
        if (closed) return;
        close();
        onFailure(message);
    };
    const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => fail("The daily message timed out. Please retry."), 270000);
    };
    const listen = (name, handler) => source.addEventListener(name, (event) => {
        if (closed) return;
        resetTimer();
        try {
            handler(JSON.parse(event.data));
        } catch {
            fail("The daily message could not be read. Please retry.");
        }
    });
    listen("delta", ({ text }) => {
        if (typeof text !== "string") throw new Error("Invalid text");
        onDelta(text);
    });
    listen("heartbeat", () => {});
    listen("end", ({ text }) => {
        if (typeof text !== "string") throw new Error("Invalid text");
        close();
        onEnd(text);
    });
    listen("failure", ({ message }) => fail(message || "The daily message failed. Please retry."));
    source.onerror = () => fail("The daily message connection failed. Check that you are signed in and the backend is running, then retry.");
    resetTimer();
    return close;
}
