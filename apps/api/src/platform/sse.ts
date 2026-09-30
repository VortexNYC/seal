/**
 * Server-sent event streams over Workers.
 *
 * A polled snapshot emitter: `read()` runs ~every 1.4s, `state` events fire
 * on change, heartbeats keep the socket warm, the stream closes on a
 * terminal status or after ~4.5 minutes (clients reconnect + resume).
 *
 * Why poll D1 rather than DO-push: D1 is already the source of truth the
 * job runner writes to — polling it keeps streams correct across runner
 * restarts with zero extra coordination.
 */

export type SseFrame = { event: string; data: unknown };

const POLL_MS = 1400;
const HEARTBEAT_MS = 14_000;
const MAX_DURATION_MS = 270_000; // 4.5 min — clients reconnect

type Snapshot<T> = { changed: boolean; terminal: boolean; value: T };

/**
 * Generic SSE loop: `poll()` returns the next snapshot; emits `state`
 * events on change, `:hb` comments every ~14s, closes on terminal/max-age.
 */
export function sseResponse<T>(args: {
  poll: () => Promise<Snapshot<T>>;
  /** Optional initial "open" event payload. */
  hello?: T;
}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      const write = (frame: SseFrame | string) => {
        try {
          const line =
            typeof frame === "string"
              ? `${frame}\n\n`
              : `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // Client gone — cancel will fire.
        }
      };

      const run = async () => {
        const startedAt = Date.now();
        let lastJson = "";
        let lastBeat = Date.now();
        if (args.hello !== undefined) {
          write({ event: "hello", data: args.hello });
        }
        while (Date.now() - startedAt < MAX_DURATION_MS) {
          let snap: Snapshot<T>;
          try {
            snap = await args.poll();
          } catch (error) {
            write({
              event: "error",
              data: {
                error: error instanceof Error ? error.message : "poll_failed",
              },
            });
            break;
          }
          const json = JSON.stringify(snap.value);
          if (json !== lastJson) {
            write({ event: "state", data: snap.value });
            lastJson = json;
          }
          if (snap.terminal) break;
          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            write(":hb");
            lastBeat = Date.now();
          }
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      void run();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
