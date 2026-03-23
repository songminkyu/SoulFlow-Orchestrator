import { describe, it, expect } from "vitest";
import { parse_executor_preference, resolve_executor_provider, type ProviderCapabilities } from "@src/providers/executor.js";

describe("parse_executor_preference", () => {
  it("recognizes claude_code", () => {
    expect(parse_executor_preference("claude_code")).toBe("claude_code");
  });

  it("recognizes openrouter", () => {
    expect(parse_executor_preference("openrouter")).toBe("openrouter");
  });

  it("recognizes orchestrator_llm", () => {
    expect(parse_executor_preference("orchestrator_llm")).toBe("orchestrator_llm");
  });

  it("recognizes gemini and gemini_cli", () => {
    expect(parse_executor_preference("gemini")).toBe("gemini");
    expect(parse_executor_preference("gemini_cli")).toBe("gemini");
  });

  it("gemini returns itself when gemini_available", () => {
    const caps = { chatgpt_available: true, claude_available: true, openrouter_available: true, gemini_available: true };
    expect(resolve_executor_provider("gemini", caps)).toBe("gemini");
  });

  it("gemini falls back when gemini_available is false", () => {
    const caps = { chatgpt_available: true, claude_available: true, openrouter_available: true };
    expect(resolve_executor_provider("gemini", caps)).toBe("chatgpt");
  });

  it("defaults to chatgpt for unknown values", () => {
    expect(parse_executor_preference("unknown")).toBe("chatgpt");
    expect(parse_executor_preference("")).toBe("chatgpt");
  });

  it("normalizes whitespace and casing", () => {
    expect(parse_executor_preference("  Claude_Code  ")).toBe("claude_code");
    expect(parse_executor_preference("OPENROUTER")).toBe("openrouter");
  });
});

describe("resolve_executor_provider", () => {
  const ALL_AVAILABLE: ProviderCapabilities = {
    chatgpt_available: true,
    claude_available: true,
    openrouter_available: true,
  };

  const NONE_AVAILABLE: ProviderCapabilities = {
    chatgpt_available: false,
    claude_available: false,
    openrouter_available: false,
  };

  it("orchestrator_llm returns itself when orchestrator_llm_available", () => {
    expect(resolve_executor_provider("orchestrator_llm", { ...ALL_AVAILABLE, orchestrator_llm_available: true })).toBe("orchestrator_llm");
  });

  it("orchestrator_llm falls back when orchestrator_llm_available is false", () => {
    expect(resolve_executor_provider("orchestrator_llm", NONE_AVAILABLE)).toBe("orchestrator_llm"); // 최종 fallback
    expect(resolve_executor_provider("orchestrator_llm", ALL_AVAILABLE)).toBe("chatgpt"); // chatgpt 사용 가능하면 chatgpt
  });

  it("openrouter returns openrouter when available", () => {
    expect(resolve_executor_provider("openrouter", ALL_AVAILABLE)).toBe("openrouter");
  });

  it("openrouter falls back to chatgpt then claude", () => {
    expect(resolve_executor_provider("openrouter", {
      chatgpt_available: true, claude_available: false, openrouter_available: false,
    })).toBe("chatgpt");

    expect(resolve_executor_provider("openrouter", {
      chatgpt_available: false, claude_available: true, openrouter_available: false,
    })).toBe("claude_code");
  });

  it("openrouter returns orchestrator_llm when nothing available", () => {
    expect(resolve_executor_provider("openrouter", NONE_AVAILABLE)).toBe("orchestrator_llm");
  });

  it("claude_code returns claude_code when available", () => {
    expect(resolve_executor_provider("claude_code", ALL_AVAILABLE)).toBe("claude_code");
  });

  it("claude_code falls back to chatgpt then openrouter", () => {
    expect(resolve_executor_provider("claude_code", {
      chatgpt_available: true, claude_available: false, openrouter_available: false,
    })).toBe("chatgpt");

    expect(resolve_executor_provider("claude_code", {
      chatgpt_available: false, claude_available: false, openrouter_available: true,
    })).toBe("openrouter");
  });

  it("chatgpt (default) returns chatgpt when available", () => {
    expect(resolve_executor_provider("chatgpt", ALL_AVAILABLE)).toBe("chatgpt");
  });

  it("chatgpt falls back through claude then openrouter", () => {
    expect(resolve_executor_provider("chatgpt", {
      chatgpt_available: false, claude_available: true, openrouter_available: true,
    })).toBe("claude_code");

    expect(resolve_executor_provider("chatgpt", {
      chatgpt_available: false, claude_available: false, openrouter_available: true,
    })).toBe("openrouter");
  });

  it("chatgpt returns orchestrator_llm when nothing available", () => {
    expect(resolve_executor_provider("chatgpt", NONE_AVAILABLE)).toBe("orchestrator_llm");
  });
});
