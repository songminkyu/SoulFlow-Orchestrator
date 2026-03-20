import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STYLES_DIR = resolve(__dirname, "../../src/styles");
const tokensContent = readFileSync(resolve(STYLES_DIR, "tokens.css"), "utf-8");
const globalContent = readFileSync(resolve(STYLES_DIR, "global.css"), "utf-8");
const variablesContent = readFileSync(resolve(STYLES_DIR, "variables.css"), "utf-8");

describe("tokens.css existence and structure", () => {
  it("tokens.css file exists and is non-empty", () => {
    expect(tokensContent.length).toBeGreaterThan(100);
  });

  it("global.css imports tokens.css", () => {
    expect(globalContent).toContain('@import "./tokens.css"');
  });

  it("global.css imports variables.css before tokens.css", () => {
    const varsIdx = globalContent.indexOf("variables.css");
    const tokensIdx = globalContent.indexOf("tokens.css");
    expect(varsIdx).toBeLessThan(tokensIdx);
  });
});

describe("gradient tokens", () => {
  it("defines --bg-gradient-dark", () => {
    expect(tokensContent).toContain("--bg-gradient-dark:");
  });
  it("defines --bg-gradient-light", () => {
    expect(tokensContent).toContain("--bg-gradient-light:");
  });
  it("defines --bg-gradient", () => {
    expect(tokensContent).toContain("--bg-gradient:");
  });
  it("light theme overrides --bg-gradient", () => {
    expect(tokensContent).toMatch(/\[data-theme="light"\][\s\S]*--bg-gradient:/);
  });
});

describe("animation tokens", () => {
  it("defines --duration-fast", () => {
    expect(tokensContent).toContain("--duration-fast:");
  });
  it("defines --duration-normal", () => {
    expect(tokensContent).toContain("--duration-normal:");
  });
  it("defines --duration-typing", () => {
    expect(tokensContent).toContain("--duration-typing:");
  });
  it("defines --ease-out", () => {
    expect(tokensContent).toContain("--ease-out:");
  });
  it("defines cursor blink keyframe", () => {
    expect(tokensContent).toContain("@keyframes cursor-blink");
  });
  it("defines --cursor-blink-speed", () => {
    expect(tokensContent).toContain("--cursor-blink-speed:");
  });
});

describe("prompt bar tokens", () => {
  it("defines --prompt-bg", () => {
    expect(tokensContent).toContain("--prompt-bg:");
  });
  it("defines --prompt-radius", () => {
    expect(tokensContent).toContain("--prompt-radius:");
  });
  it("defines --prompt-max-width", () => {
    expect(tokensContent).toContain("--prompt-max-width:");
  });
});

describe("popover tokens", () => {
  it("defines --popover-bg", () => {
    expect(tokensContent).toContain("--popover-bg:");
  });
  it("defines --popover-max-height", () => {
    expect(tokensContent).toContain("--popover-max-height:");
  });
});

describe("chat message tokens", () => {
  it("defines --msg-user-bg", () => {
    expect(tokensContent).toContain("--msg-user-bg:");
  });
  it("defines --msg-max-width", () => {
    expect(tokensContent).toContain("--msg-max-width:");
  });
});

describe("chip/badge tokens", () => {
  it("defines --chip-bg", () => {
    expect(tokensContent).toContain("--chip-bg:");
  });
  it("defines --chip-radius", () => {
    expect(tokensContent).toContain("--chip-radius:");
  });
});

describe("z-index scale", () => {
  it("defines --z-base through --z-tooltip", () => {
    for (const level of ["base", "dropdown", "sticky", "overlay", "modal", "popover", "toast", "tooltip"]) {
      expect(tokensContent).toContain(`--z-${level}:`);
    }
  });
});

describe("sidebar tokens", () => {
  it("defines --sidebar-width", () => {
    expect(tokensContent).toContain("--sidebar-width:");
  });
  it("defines --sidebar-collapsed-width", () => {
    expect(tokensContent).toContain("--sidebar-collapsed-width:");
  });
});

describe("breakpoint tokens", () => {
  it("defines --bp-sm through --bp-2xl", () => {
    for (const bp of ["sm", "md", "lg", "xl", "2xl"]) {
      expect(tokensContent).toContain(`--bp-${bp}:`);
    }
  });
});

describe("variables.css regression", () => {
  it("still defines core color tokens", () => {
    expect(variablesContent).toContain("--bg:");
    expect(variablesContent).toContain("--panel:");
    expect(variablesContent).toContain("--text:");
    expect(variablesContent).toContain("--accent:");
  });
  it("still defines spacing tokens", () => {
    expect(variablesContent).toContain("--sp-1:");
    expect(variablesContent).toContain("--sp-8:");
  });
  it("still defines light theme", () => {
    expect(variablesContent).toContain('[data-theme="light"]');
  });
});

describe("no collision between tokens.css and variables.css", () => {
  it("tokens.css does not redefine --bg", () => {
    // tokens.css defines --bg-gradient but NOT --bg itself
    const lines = tokensContent.split("\n");
    const bgRedefinitions = lines.filter(l => /^\s*--bg\s*:/.test(l));
    expect(bgRedefinitions).toHaveLength(0);
  });
  it("tokens.css does not redefine --panel", () => {
    const lines = tokensContent.split("\n");
    const panelRedefinitions = lines.filter(l => /^\s*--panel\s*:/.test(l));
    expect(panelRedefinitions).toHaveLength(0);
  });
});
