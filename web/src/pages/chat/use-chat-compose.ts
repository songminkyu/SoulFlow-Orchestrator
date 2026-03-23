import { useReducer } from "react";
import type { ChatMediaItem } from "./types";

/* ── State ── */

interface ComposeState {
  input: string;
  sending: boolean;
  waiting_response: boolean;
  pending_media: ChatMediaItem[];
  sent_msg_count: number;
}

/* ── Actions ── */

type ComposeAction =
  | { type: "set_input"; value: string }
  | { type: "start_send"; sent_count: number }
  | { type: "finish_send" }
  | { type: "set_waiting"; value: boolean }
  | { type: "add_media"; item: ChatMediaItem }
  | { type: "clear_media" }
  | { type: "set_sent_count"; count: number };

function compose_reducer(state: ComposeState, action: ComposeAction): ComposeState {
  switch (action.type) {
    case "set_input":
      return { ...state, input: action.value };
    case "start_send":
      // 원자적 전환: 전송 시작 = sending, waiting, input 초기화, media 초기화
      return { ...state, sending: true, waiting_response: true, input: "", pending_media: [], sent_msg_count: action.sent_count };
    case "finish_send":
      return { ...state, sending: false };
    case "set_waiting":
      return { ...state, waiting_response: action.value };
    case "add_media":
      return { ...state, pending_media: [...state.pending_media, action.item] };
    case "clear_media":
      return { ...state, pending_media: [] };
    case "set_sent_count":
      return { ...state, sent_msg_count: action.count };
    default:
      return state;
  }
}

const INITIAL_STATE: ComposeState = {
  input: "",
  sending: false,
  waiting_response: false,
  pending_media: [],
  sent_msg_count: 0,
};

/* ── Hook ── */

export function useChatCompose() {
  const [state, dispatch] = useReducer(compose_reducer, INITIAL_STATE);

  return {
    input: state.input,
    sending: state.sending,
    waiting_response: state.waiting_response,
    pending_media: state.pending_media,
    sent_msg_count: state.sent_msg_count,
    set_input: (value: string) => dispatch({ type: "set_input", value }),
    start_send: (sent_count: number) => dispatch({ type: "start_send", sent_count }),
    finish_send: () => dispatch({ type: "finish_send" }),
    set_waiting: (value: boolean) => dispatch({ type: "set_waiting", value }),
    add_media: (item: ChatMediaItem) => dispatch({ type: "add_media", item }),
    clear_media: () => dispatch({ type: "clear_media" }),
  };
}
