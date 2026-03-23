/**
 * sandbox-runner — vm.runInNewContext 기반 격리 실행.
 *
 * `new Function()` 대체. process/require/globalThis 등 Node.js 전역 차단,
 * Math/JSON/Date 등 안전한 전역만 허용.
 * timeout으로 무한루프 차단.
 */

import vm from "node:vm";

/** 샌드박스 실행 결과. */
export type SandboxResult = { result: unknown } | { error: string };

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * 안전한 전역만 포함하는 context 생성.
 * process, require, globalThis, __dirname, __filename 등 Node.js 전역 제거.
 */
function create_safe_context(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    // 안전한 내장 객체
    Math,
    JSON,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    URIError,
    EvalError,
    Promise,
    Proxy,
    Reflect,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,
    NaN,
    Infinity,
    undefined,

    // 명시적 차단: undefined로 설정하여 접근 시 undefined 반환
    process: undefined,
    require: undefined,
    globalThis: undefined,
    global: undefined,
    __dirname: undefined,
    __filename: undefined,
    module: undefined,
    exports: undefined,
    Buffer: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    clearTimeout: undefined,
    clearInterval: undefined,
    clearImmediate: undefined,
    queueMicrotask: undefined,

    // 사용자 주입 변수
    ...extra,
  };
}

/**
 * vm.runInNewContext로 코드를 격리 실행.
 *
 * @param code       실행할 JavaScript 코드
 * @param variables  코드에 주입할 변수 (context)
 * @param timeout_ms 타임아웃 (기본 5000ms)
 */
export function sandbox_run(
  code: string,
  variables: Record<string, unknown> = {},
  timeout_ms: number = DEFAULT_TIMEOUT_MS,
): SandboxResult {
  const context = create_safe_context(variables);
  vm.createContext(context);

  try {
    const result = vm.runInNewContext(code, context, {
      timeout: timeout_ms,
      filename: "sandbox.vm",
      // microtaskMode: "afterEvaluate" — Promise 체인도 timeout 영향 아래 둠
      microtaskMode: "afterEvaluate",
    });
    return { result };
  } catch (e) {
    if (e instanceof Error) {
      return { error: e.message };
    }
    return { error: String(e) };
  }
}

/**
 * Function-body 스타일 코드를 expression으로 래핑.
 * `new Function(...keys, body)` 패턴을 대체.
 *
 * @param keys   파라미터 이름 목록
 * @param body   함수 본문 (return 포함 가능)
 * @param values 파라미터 값 목록
 * @param timeout_ms 타임아웃
 */
export function sandbox_run_as_function(
  keys: string[],
  body: string,
  values: unknown[],
  timeout_ms: number = DEFAULT_TIMEOUT_MS,
): SandboxResult {
  const variables: Record<string, unknown> = {};
  for (let i = 0; i < keys.length; i++) {
    variables[keys[i]] = values[i];
  }

  // "use strict" 래핑 + IIFE로 return 문 지원
  const wrapped = `(function(${keys.join(", ")}) {\n"use strict";\n${body}\n})(${keys.map((k) => k).join(", ")})`;
  return sandbox_run(wrapped, variables, timeout_ms);
}

/**
 * 단순 표현식 평가. `new Function("return (expr)")` 패턴 대체.
 *
 * @param expression 평가할 표현식
 * @param variables  표현식에서 참조할 변수
 * @param timeout_ms 타임아웃
 */
export function sandbox_eval(
  expression: string,
  variables: Record<string, unknown> = {},
  timeout_ms: number = DEFAULT_TIMEOUT_MS,
): SandboxResult {
  return sandbox_run(expression, variables, timeout_ms);
}
