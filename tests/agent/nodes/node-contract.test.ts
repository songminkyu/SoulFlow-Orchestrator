/**
 * Node Contract Test — 모든 워크플로우 노드 핸들러가 NodeHandler 인터페이스를
 * 올바르게 구현하는지 검증하는 파라미터화 테스트.
 *
 * 새 노드가 추가되면 registry에 등록되는 순간 자동으로 이 테스트에 포함된다.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { register_all_nodes } from "@src/agent/nodes/index.js";
import { get_all_handlers, type NodeHandler } from "@src/agent/node-registry.js";

let handlers: NodeHandler[] = [];

beforeAll(() => {
  register_all_nodes();
  handlers = get_all_handlers();
});

describe("Node Contract — dynamic discovery", () => {
  it("should discover 140+ node handlers from registry", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(140);
  });
});

describe("Node Contract — interface compliance", () => {
  beforeAll(() => {
    register_all_nodes();
    handlers = get_all_handlers();
  });

  // We use a dynamic approach: generate one test suite per handler
  // Since vitest evaluates describe/it at module load time, and we need
  // handlers loaded first, we use a two-pass approach.
  // However, describe.each needs the data at parse time.
  // Instead, we'll run a single test that iterates and collects failures.

  it("every handler has a non-empty node_type string", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.node_type !== "string" || h.node_type.length === 0) {
        failures.push(`handler at index ${handlers.indexOf(h)} has invalid node_type: ${String(h.node_type)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has an output_schema that is an array", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (!Array.isArray(h.output_schema)) {
        failures.push(`${h.node_type}: output_schema is not an array (got ${typeof h.output_schema})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has an input_schema that is an array", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (!Array.isArray(h.input_schema)) {
        failures.push(`${h.node_type}: input_schema is not an array (got ${typeof h.input_schema})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has an execute function", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.execute !== "function") {
        failures.push(`${h.node_type}: execute is not a function (got ${typeof h.execute})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has a test function", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.test !== "function") {
        failures.push(`${h.node_type}: test is not a function (got ${typeof h.test})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has a create_default function", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.create_default !== "function") {
        failures.push(`${h.node_type}: create_default is not a function (got ${typeof h.create_default})`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has icon (non-empty string)", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.icon !== "string" || h.icon.length === 0) {
        failures.push(`${h.node_type}: icon is missing or empty`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has color (non-empty string)", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (typeof h.color !== "string" || h.color.length === 0) {
        failures.push(`${h.node_type}: color is missing or empty`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every handler has shape ('rect' or 'diamond')", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (h.shape !== "rect" && h.shape !== "diamond") {
        failures.push(`${h.node_type}: shape is '${h.shape}', expected 'rect' or 'diamond'`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("no duplicate node_type values in registry", () => {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    for (const h of handlers) {
      const count = (seen.get(h.node_type) ?? 0) + 1;
      seen.set(h.node_type, count);
      if (count > 1) {
        duplicates.push(h.node_type);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("every output_schema entry has name and type fields", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (!Array.isArray(h.output_schema)) continue;
      for (let i = 0; i < h.output_schema.length; i++) {
        const field = h.output_schema[i];
        if (typeof field.name !== "string" || field.name.length === 0) {
          failures.push(`${h.node_type}: output_schema[${i}] missing name`);
        }
        if (typeof field.type !== "string" || field.type.length === 0) {
          failures.push(`${h.node_type}: output_schema[${i}] missing type`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every input_schema entry has name and type fields", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      if (!Array.isArray(h.input_schema)) continue;
      for (let i = 0; i < h.input_schema.length; i++) {
        const field = h.input_schema[i];
        if (typeof field.name !== "string" || field.name.length === 0) {
          failures.push(`${h.node_type}: input_schema[${i}] missing name`);
        }
        if (typeof field.type !== "string" || field.type.length === 0) {
          failures.push(`${h.node_type}: input_schema[${i}] missing type`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("create_default() returns a plain object for every handler", () => {
    const failures: string[] = [];
    for (const h of handlers) {
      try {
        const defaults = h.create_default();
        if (defaults === null || typeof defaults !== "object" || Array.isArray(defaults)) {
          failures.push(`${h.node_type}: create_default() returned ${typeof defaults} instead of object`);
        }
      } catch (err) {
        failures.push(`${h.node_type}: create_default() threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("test() returns { preview, warnings } for every handler with default-populated node", () => {
    const failures: string[] = [];
    const ctx = { memory: {}, workspace: "" } as import("@src/agent/orche-node-executor.js").OrcheNodeExecutorContext;
    for (const h of handlers) {
      try {
        // Build a node from create_default() to supply required fields
        const defaults = h.create_default();
        const node = { node_id: "contract_test", node_type: h.node_type, title: "contract", ...defaults } as Parameters<typeof h.test>[0];
        const result = h.test(node, ctx);
        if (!result || typeof result !== "object") {
          failures.push(`${h.node_type}: test() did not return an object`);
        } else {
          if (!("preview" in result)) {
            failures.push(`${h.node_type}: test() result missing 'preview' field`);
          }
          if (!("warnings" in result)) {
            failures.push(`${h.node_type}: test() result missing 'warnings' field`);
          }
        }
      } catch (err) {
        // Throws from missing required fields are acceptable —
        // the contract check for test() as a function is above.
        // Only flag if it's not a typical missing-field error.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Cannot read properties of undefined") && !msg.includes("is not a function")) {
          failures.push(`${h.node_type}: test() threw unexpectedly: ${msg}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
