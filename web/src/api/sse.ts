type SseHandler = (data: unknown) => void;

const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;

export function create_sse(
  path: string,
  handlers: Record<string, SseHandler>,
  /** PCH-U4: 연결 끊김 후 재연결 대기 진입 시 호출 */
  on_reconnecting?: () => void,
): { close: () => void } {
  let es: EventSource | null = null;
  let reconnect_timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let closed = false;

  function connect() {
    if (closed) return;
    es = new EventSource(path);

    es.onopen = () => { attempt = 0; };

    for (const [event, handler] of Object.entries(handlers)) {
      es.addEventListener(event, (e) => {
        try { handler(JSON.parse((e as MessageEvent).data)); } catch (err) {
          console.warn("[sse] JSON parse error on event", event, err);
        }
      });
    }

    es.onerror = () => {
      es?.close();
      es = null;
      if (closed) return;
      on_reconnecting?.();
      const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      attempt++;
      reconnect_timer = setTimeout(connect, delay);
    };
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnect_timer) clearTimeout(reconnect_timer);
      es?.close();
      es = null;
    },
  };
}
