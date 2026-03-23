/** PCH-Q8: 표준 폴링 간격 — 관리자/모니터링 데이터 */
export const POLL_FAST_MS = 30_000;
/** PCH-Q8: 느린 폴링 간격 — 사용량/모델 목록 */
export const POLL_SLOW_MS = 60_000;

export const PROVIDER_COLORS: Record<string, string> = {
  slack: "#36C5F0",
  discord: "#5865F2",
  telegram: "#2AABEE",
};

export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  claude_cli: "Claude CLI",
  codex_cli: "Codex CLI",
  claude_sdk: "Claude SDK",
  codex_appserver: "Codex Appserver",
  openrouter: "OpenRouter",
  openai_compatible: "OpenAI Compatible",
  gemini_cli: "Gemini CLI",
  ollama: "Ollama",
};
