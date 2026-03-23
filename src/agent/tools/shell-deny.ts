/**
 * Shell deny/block 패턴 — ExecTool + Shell workflow node 공용.
 *
 * CWE-78 (OS Command Injection) 방지를 위한 공통 상수·함수.
 * 양쪽에서 동일한 패턴을 참조해 정책 차이를 방지한다.
 */

// ── 파괴적 명령 차단 패턴 (ExecTool + Shell node 공용) ────────────────────────

/** ExecTool과 Shell workflow node가 공유하는 deny 패턴 (문자열). */
export const SHARED_DENY_PATTERNS: readonly string[] = [
  "\\brm\\s+-[rf]{1,2}\\b",
  "\\bdel\\s+/[fq]\\b",
  "\\brmdir\\s+/s\\b",
  "(?:^|[;&|]\\s*)format\\b",
  "\\b(mkfs|diskpart)\\b",
  "\\bdd\\s+if=",
  ">\\s*/dev/sd",
  "\\b(shutdown|reboot|poweroff)\\b",
  ":\\(\\)\\s*\\{.*\\};\\s*:",
  "\\b(base64|certutil|openssl)\\b[\\s\\S]{0,120}(?:--decode|-d|decode)[\\s\\S]{0,120}\\|\\s*(?:bash|sh|zsh|pwsh|powershell|cmd(?:\\.exe)?)\\b",
  "\\b(?:iex|invoke-expression)\\b",
] as const;

/** SHARED_DENY_PATTERNS를 컴파일한 RegExp 배열 (case-insensitive). */
export const SHARED_DENY_REGEXPS: readonly RegExp[] = SHARED_DENY_PATTERNS.map(
  (p) => new RegExp(p, "i"),
);

// ── Shell 메타문자 검사 (argv 전환 시 입력 검증용) ────────────────────────────

/**
 * 셸 메타문자 포함 여부를 확인한다.
 * argv 배열로 실행하는 도구(Docker, ProcessManager 등)에서
 * 사용자 입력에 shell injection 벡터가 없는지 검증하는 데 사용한다.
 */
const SHELL_META_RE = /[;&|`$(){}!<>\\]/;

export function has_shell_metacharacters(text: string): boolean {
  return SHELL_META_RE.test(text);
}
