import { create } from "zustand";
import type { CanvasSpec } from "../../src/dashboard/canvas.types";

type ConnectionState = "connected" | "disconnected" | "reconnecting";
type Theme = "dark" | "light";

interface WebStream {
  chat_id: string;
  content: string;
  done?: boolean;
}

export interface MirrorMessageEvent {
  session_key: string;
  direction: string;
  sender_id: string;
  content: string;
  at: string;
}

interface DashboardStore {
  connection: ConnectionState;
  set_connection: (s: ConnectionState) => void;
  sidebar_collapsed: boolean;
  toggle_sidebar: () => void;
  sidebar_open: boolean;
  open_sidebar: () => void;
  close_sidebar: () => void;
  web_stream: WebStream | null;
  set_web_stream: (s: WebStream | null) => void;
  mirror_event: MirrorMessageEvent | null;
  set_mirror_event: (e: MirrorMessageEvent | null) => void;
  canvas_specs: Map<string, CanvasSpec[]>;
  push_canvas: (chat_id: string, spec: CanvasSpec) => void;
  dismiss_canvas: (chat_id: string, canvas_id: string) => void;
  theme: Theme;
  toggle_theme: () => void;
}

function load_theme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* storage blocked */ }
  return "dark";
}

/** 모바일 기본값: 768px 이하이면 접힘 */
function load_sidebar_collapsed(): boolean {
  try {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true" || saved === "false") return saved === "true";
  } catch { /* storage blocked */ }
  // 모바일 브레이크포인트: 기본 접힘
  return typeof window !== "undefined" && window.innerWidth <= 768;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  connection: "disconnected",
  set_connection: (connection) => set({ connection }),
  sidebar_collapsed: load_sidebar_collapsed(),
  toggle_sidebar: () => set((s) => {
    const next = !s.sidebar_collapsed;
    try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* storage blocked */ }
    return { sidebar_collapsed: next };
  }),
  sidebar_open: false,
  open_sidebar: () => set({ sidebar_open: true }),
  close_sidebar: () => set({ sidebar_open: false }),
  web_stream: null,
  set_web_stream: (web_stream) => set({ web_stream }),
  mirror_event: null,
  set_mirror_event: (mirror_event) => set({ mirror_event }),
  canvas_specs: new Map(),
  push_canvas: (chat_id, spec) => set((s) => {
    const next = new Map(s.canvas_specs);
    const list = [...(next.get(chat_id) ?? [])];
    const idx = list.findIndex((c) => c.canvas_id === spec.canvas_id);
    if (idx >= 0) list[idx] = spec; else list.push(spec);
    next.set(chat_id, list);
    return { canvas_specs: next };
  }),
  dismiss_canvas: (chat_id, canvas_id) => set((s) => {
    const next = new Map(s.canvas_specs);
    const list = (next.get(chat_id) ?? []).filter((c) => c.canvas_id !== canvas_id);
    if (list.length > 0) next.set(chat_id, list); else next.delete(chat_id);
    return { canvas_specs: next };
  }),
  theme: load_theme(),
  toggle_theme: () => set((s) => {
    const next: Theme = s.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", next); } catch { /* storage blocked */ }
    return { theme: next };
  }),
}));
