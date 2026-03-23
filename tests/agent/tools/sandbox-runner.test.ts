/**
 * sandbox-runner — vm.runInNewContext 기반 격리 실행 테스트.
 *
 * 검증 항목:
 * 1. process.exit() → Error (프로세스 종료 없음)
 * 2. require('child_process') → Error
 * 3. global.process.env.SECRET → undefined
 * 4. 정상 수식 평가 (2+2=4, Math.sqrt(16)=4) 동작 확인
 */

import { describe, it, expect } from "vitest";
import {
  sandbox_run,
  sandbox_run_as_function,
  sandbox_eval,
} from "@src/agent/tools/sandbox-runner.js";

// ══════════════════════════════════════════
// 보안 격리 — 핵심 완료 기준
// ══════════════════════════════════════════

describe("sandbox-runner — RCE 격리", () => {
  it("process.exit() → Error 반환 (프로세스 종료 없음)", () => {
    const out = sandbox_run("process.exit(1)");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toBeTruthy();
    }
  });

  it("require('child_process') → Error 반환", () => {
    const out = sandbox_run("require('child_process')");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toBeTruthy();
    }
  });

  it("global.process.env.SECRET → undefined 반환", () => {
    // process가 undefined이므로 process.env 접근 시 TypeError
    const out = sandbox_eval("typeof process === 'undefined' ? undefined : process.env.SECRET");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBeUndefined();
    }
  });

  it("process.env 접근 → TypeError (process is undefined)", () => {
    const out = sandbox_run("process.env.SECRET");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toMatch(/Cannot read properties of undefined|process is not defined/);
    }
  });

  it("globalThis 접근 → undefined", () => {
    const out = sandbox_eval("typeof globalThis");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("undefined");
    }
  });

  it("__dirname 접근 → undefined", () => {
    const out = sandbox_eval("typeof __dirname");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("undefined");
    }
  });

  it("Buffer 접근 → undefined", () => {
    const out = sandbox_eval("typeof Buffer");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("undefined");
    }
  });

  it("setTimeout 접근 → undefined", () => {
    const out = sandbox_eval("typeof setTimeout");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("undefined");
    }
  });

  it("require 접근 → undefined (호출 시 TypeError)", () => {
    const out = sandbox_eval("typeof require");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("undefined");
    }
  });
});

// ══════════════════════════════════════════
// 정상 수식 평가
// ══════════════════════════════════════════

describe("sandbox-runner — 정상 수식 평가", () => {
  it("2 + 2 = 4", () => {
    const out = sandbox_eval("2 + 2");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(4);
  });

  it("Math.sqrt(16) = 4", () => {
    const out = sandbox_eval("Math.sqrt(16)");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(4);
  });

  it("Math.PI 접근", () => {
    const out = sandbox_eval("Math.PI");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBeCloseTo(3.14159, 4);
  });

  it("JSON.stringify 동작", () => {
    const out = sandbox_eval('JSON.stringify({ a: 1 })');
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe('{"a":1}');
  });

  it("Date 생성", () => {
    const out = sandbox_eval("new Date(0).toISOString()");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe("1970-01-01T00:00:00.000Z");
  });

  it("Array 메서드", () => {
    const out = sandbox_eval("[1,2,3].map(x => x * 2)");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toEqual([2, 4, 6]);
  });

  it("RegExp 동작", () => {
    const out = sandbox_eval("/^hello/.test('hello world')");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(true);
  });

  it("parseInt / parseFloat", () => {
    const out = sandbox_eval("parseInt('42') + parseFloat('0.5')");
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(42.5);
  });
});

// ══════════════════════════════════════════
// sandbox_run_as_function — Function-body 스타일
// ══════════════════════════════════════════

describe("sandbox_run_as_function", () => {
  it("변수 주입 + return 문", () => {
    const out = sandbox_run_as_function(["x", "y"], "return x + y", [10, 5]);
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(15);
  });

  it("빈 파라미터 + 간단한 코드", () => {
    const out = sandbox_run_as_function([], "return 42", []);
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(42);
  });

  it("process.exit 차단 (Function-body 스타일)", () => {
    const out = sandbox_run_as_function([], "process.exit(1)", []);
    expect("error" in out).toBe(true);
  });

  it("require 차단 (Function-body 스타일)", () => {
    const out = sandbox_run_as_function([], "return require('fs')", []);
    expect("error" in out).toBe(true);
  });
});

// ══════════════════════════════════════════
// sandbox_eval — 표현식 평가
// ══════════════════════════════════════════

describe("sandbox_eval — 변수 주입", () => {
  it("변수 참조 표현식", () => {
    const out = sandbox_eval("x * y + 1", { x: 3, y: 4 });
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(13);
  });

  it("row 객체 참조 (table filter 패턴)", () => {
    const out = sandbox_eval("row.age > 18", { row: { name: "Alice", age: 25 } });
    expect("result" in out).toBe(true);
    if ("result" in out) expect(out.result).toBe(true);
  });
});

// ══════════════════════════════════════════
// 타임아웃 차단
// ══════════════════════════════════════════

describe("sandbox-runner — 타임아웃", () => {
  it("무한루프 → timeout error", () => {
    const out = sandbox_run("while(true){}", {}, 100);
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toMatch(/timed out|Script execution timed out/);
    }
  });
});

// ══════════════════════════════════════════
// 에러 처리
// ══════════════════════════════════════════

describe("sandbox-runner — 에러 처리", () => {
  it("SyntaxError → error 문자열", () => {
    const out = sandbox_run("}{");
    expect("error" in out).toBe(true);
  });

  it("ReferenceError → error 문자열", () => {
    const out = sandbox_run("unknownVariable");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toMatch(/not defined/);
    }
  });

  it("throw 문 → error 문자열", () => {
    const out = sandbox_run("throw new Error('custom')");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toBe("custom");
    }
  });

  it("throw 비-Error → error 문자열", () => {
    const out = sandbox_run("throw 'string error'");
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(out.error).toBe("string error");
    }
  });
});
