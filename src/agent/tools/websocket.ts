/** WebSocket 도구 — WebSocket 클라이언트 (connect/send/listen/close). */

import { WebSocket } from "ws";
import { Tool } from "./base.js";
import type { JsonSchema, ToolExecutionContext } from "./types.js";

/* PCH-S13: 세션 격리 + TTL ─────────────────────────────────────────────── */
type WsEntry = { ws: WebSocket; messages: string[]; created: number; last_used: number };
/** 네임스페이스별 연결 풀. 키 형식: `${namespace}:${id}` */
const connections = new Map<string, WsEntry>();
const MAX_CONNECTIONS = 10;
const MAX_MESSAGES = 100;
/** 30분 미사용 연결 자동 정리 */
const WS_TTL_MS = 30 * 60_000;

/** context에서 격리 네임스페이스 추출 — team_id > task_id > "global" */
function _ns(context?: ToolExecutionContext): string {
  return context?.team_id ?? context?.task_id ?? "global";
}

/** TTL 초과 연결 정리 (connect 시 호출). */
function _prune_stale(): void {
  const now = Date.now();
  for (const [key, entry] of connections) {
    if (now - entry.last_used > WS_TTL_MS) {
      try { entry.ws.close(); } catch { /* no-op */ }
      connections.delete(key);
    }
  }
}

/** 네임스페이스 내 활성 연결 수. */
function _ns_count(ns: string): number {
  let count = 0;
  for (const key of connections.keys()) {
    if (key.startsWith(`${ns}:`)) count++;
  }
  return count;
}

export class WebSocketTool extends Tool {
  readonly name = "websocket";
  readonly category = "external" as const;
  readonly description = "WebSocket client: connect, send, receive, close, list.";
  readonly policy_flags = { network: true };
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["connect", "send", "receive", "close", "list"], description: "WebSocket operation" },
      url: { type: "string", description: "WebSocket URL (ws:// or wss://)" },
      id: { type: "string", description: "Connection ID (auto-generated on connect)" },
      message: { type: "string", description: "Message to send (for send action)" },
      count: { type: "integer", description: "Max messages to receive (default: 10)" },
      timeout_ms: { type: "integer", description: "Connect/receive timeout (default: 5000)" },
    },
    required: ["action"],
    additionalProperties: false,
  };

  protected async run(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const action = String(params.action || "list");

    switch (action) {
      case "connect": return this.connect(params, context);
      case "send": return this.send(params, context);
      case "receive": return this.receive(params, context);
      case "close": return this.close_conn(params, context);
      case "list": return this.list(context);
      default: return `Error: unsupported action "${action}"`;
    }
  }

  private connect(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const url = String(params.url || "");
    if (!url) return Promise.resolve("Error: url is required");
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      return Promise.resolve("Error: url must start with ws:// or wss://");
    }

    // PCH-S13: TTL 만료 연결 정리 후 네임스페이스 내 한도 확인
    _prune_stale();
    const ns = _ns(context);
    if (_ns_count(ns) >= MAX_CONNECTIONS) {
      return Promise.resolve(`Error: max ${MAX_CONNECTIONS} connections reached for this session`);
    }

    const timeout = Math.min(Number(params.timeout_ms) || 5000, 30000);
    const raw_id = String(params.id || `ws_${Date.now()}`);
    const full_key = `${ns}:${raw_id}`;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.close();
        resolve("Error: connection timeout");
      }, timeout);

      const ws = new WebSocket(url);

      ws.on("open", () => {
        clearTimeout(timer);
        const now = Date.now();
        const entry: WsEntry = { ws, messages: [], created: now, last_used: now };
        connections.set(full_key, entry);

        ws.on("message", (data: Buffer | string) => {
          if (entry.messages.length < MAX_MESSAGES) {
            entry.messages.push(String(data));
            entry.last_used = Date.now();
          }
        });

        ws.on("close", () => { connections.delete(full_key); });
        ws.on("error", () => { connections.delete(full_key); });

        resolve(JSON.stringify({ id: raw_id, url, status: "connected" }));
      });

      ws.on("error", (err: Error) => {
        clearTimeout(timer);
        resolve(`Error: ${err.message}`);
      });
    });
  }

  private send(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const raw_id = String(params.id || "");
    const message = String(params.message || "");
    const entry = connections.get(`${_ns(context)}:${raw_id}`);
    if (!entry) return Promise.resolve(`Error: connection "${raw_id}" not found`);
    if (entry.ws.readyState !== WebSocket.OPEN) return Promise.resolve("Error: connection not open");

    entry.last_used = Date.now();
    return new Promise((resolve) => {
      entry.ws.send(message, (err: Error | undefined) => {
        if (err) resolve(`Error: ${err.message}`);
        else resolve(JSON.stringify({ id: raw_id, sent: true, length: message.length }));
      });
    });
  }

  private receive(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const raw_id = String(params.id || "");
    const count = Math.max(1, Math.min(100, Number(params.count) || 10));
    const timeout = Math.min(Number(params.timeout_ms) || 5000, 30000);
    const entry = connections.get(`${_ns(context)}:${raw_id}`);
    if (!entry) return Promise.resolve(`Error: connection "${raw_id}" not found`);

    entry.last_used = Date.now();
    if (entry.messages.length > 0) {
      const msgs = entry.messages.splice(0, count);
      return Promise.resolve(JSON.stringify({ id: raw_id, messages: msgs, count: msgs.length }));
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const msgs = entry.messages.splice(0, count);
        resolve(JSON.stringify({ id: raw_id, messages: msgs, count: msgs.length, timeout: true }));
      }, timeout);

      const check = (): void => {
        if (entry.messages.length > 0) {
          clearTimeout(timer);
          const msgs = entry.messages.splice(0, count);
          resolve(JSON.stringify({ id: raw_id, messages: msgs, count: msgs.length }));
        } else if (entry.ws.readyState !== WebSocket.OPEN) {
          clearTimeout(timer);
          resolve(JSON.stringify({ id: raw_id, messages: [], count: 0, closed: true }));
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    });
  }

  private close_conn(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const raw_id = String(params.id || "");
    const full_key = `${_ns(context)}:${raw_id}`;
    const entry = connections.get(full_key);
    if (!entry) return Promise.resolve(`Error: connection "${raw_id}" not found`);
    entry.ws.close();
    connections.delete(full_key);
    return Promise.resolve(JSON.stringify({ id: raw_id, status: "closed" }));
  }

  private list(context?: ToolExecutionContext): string {
    const ns = _ns(context);
    const prefix = `${ns}:`;
    const list = [...connections.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, e]) => ({
        id: key.slice(prefix.length),
        state: e.ws.readyState === WebSocket.OPEN ? "open" : "closed",
        buffered_messages: e.messages.length,
        age_ms: Date.now() - e.created,
        idle_ms: Date.now() - e.last_used,
      }));
    return JSON.stringify({ connections: list, count: list.length });
  }
}
