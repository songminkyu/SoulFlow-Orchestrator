/** CLI 에이전트(Claude Code, Codex, Gemini)의 인증 상태 확인. 로그인은 CLI에서 직접 수행. */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../logger.js";

// ── 타입 ───────────────────────────────────────────────────────────────────────

export type CliType = "claude" | "codex" | "gemini";

export interface CliAuthStatus {
  cli: CliType;
  authenticated: boolean;
  account?: string;
  error?: string;
}

// ── 서비스 ─────────────────────────────────────────────────────────────────────

export interface CliAuthServiceOptions {
  logger: Logger;
  /** CLI 인증 파일 홈 디렉토리. user_dir/.agents 에 .claude/.codex/.gemini 존재. */
  agents_home?: string;
}

export class CliAuthService {
  private readonly logger: Logger;
  private readonly agents_home: string;
  private readonly status_cache = new Map<CliType, CliAuthStatus>();

  constructor(opts: CliAuthServiceOptions) {
    this.logger = opts.logger;
    this.agents_home = opts.agents_home || process.env.HOME || "/root";
    // Docker 환경: .claude/debug 디렉토리 사전 생성 (Claude CLI가 쓰기 시도)
    this._ensure_cli_dirs();
  }

  /** CLI별 필수 디렉토리 사전 생성. Claude CLI가 debug/ 없이 크래시하는 것 방지. */
  private _ensure_cli_dirs(): void {
    try {
      const claude_dir = join(this.agents_home, ".claude", "debug");
      if (!existsSync(claude_dir)) mkdirSync(claude_dir, { recursive: true });
    } catch { /* 권한 없으면 무시 — check()에서 에러 처리 */ }
  }

  /** CLI 인증 상태 확인. CLI별 전용 로직 분기. */
  async check(cli: CliType): Promise<CliAuthStatus> {
    const checkers: Record<CliType, () => CliAuthStatus | Promise<CliAuthStatus>> = {
      claude: () => this.check_claude(),
      codex: () => this.check_codex(),
      gemini: () => this.check_gemini(),
    };
    const status = await checkers[cli]();
    this.status_cache.set(cli, status);
    this.logger.info("auth check", { cli, authenticated: status.authenticated, account: status.account });
    return status;
  }

  /** 모든 CLI의 인증 상태를 한 번에 확인. */
  async check_all(): Promise<CliAuthStatus[]> {
    return Promise.all([this.check("claude"), this.check("codex"), this.check("gemini")]);
  }

  /** 캐시된 상태 반환 (check() 호출 전엔 미인증으로 반환). */
  get_cached(cli: CliType): CliAuthStatus {
    return this.status_cache.get(cli) ?? { cli, authenticated: false };
  }

  /** 모든 CLI의 캐시된 상태 반환. */
  get_all_cached(): CliAuthStatus[] {
    return [this.get_cached("claude"), this.get_cached("codex"), this.get_cached("gemini")];
  }

  // ── Claude Code ────────────────────────────────────────────────────────────

  /**
   * `claude auth status` → JSON 출력 파싱.
   * agents_home에서 먼저 시도, 실패 시 /root (Docker 마운트 경로) fallback.
   * stderr 경고가 stdout과 혼합되는 문제 대응: stdout만 JSON 파싱.
   */
  private async check_claude(): Promise<CliAuthStatus> {
    // 1차: 설정된 agents_home 경로로 시도
    const result = await this._run_claude_auth(this.agents_home);
    if (result.authenticated) return result;

    // 2차: fallback 경로 탐색 — Docker 마운트, HOME, WORKSPACE/.agents
    const fallback_homes = [
      process.env.HOME || "/root",                                      // 사용자 HOME
      join(process.env.WORKSPACE || "/data", ".agents"),                // WORKSPACE/.agents (compose 마운트)
      "/root",                                                          // Docker 기본
    ].filter(p => p !== this.agents_home);

    for (const fallback of fallback_homes) {
      const fallback_result = await this._run_claude_auth(fallback);
      if (fallback_result.authenticated) {
        this.logger.info("claude auth: fallback path", { path: fallback });
        return fallback_result;
      }
    }

    // 3차: credential 파일 직접 탐색 (CLI 없이도 인증 확인)
    const cred_paths = [
      join(this.agents_home, ".claude", ".credentials.json"),
      ...fallback_homes.map(p => join(p, ".claude", ".credentials.json")),
    ];
    for (const cred_path of cred_paths) {
      if (existsSync(cred_path)) {
        return { cli: "claude", authenticated: true, account: `credential: ${cred_path}` };
      }
    }

    return result; // 1차 결과 반환 (에러 메시지 포함)
  }

  /** claude auth status 실행 + stdout 전용 JSON 파싱. */
  private _run_claude_auth(home: string): Promise<CliAuthStatus> {
    return new Promise<CliAuthStatus>((resolve) => {
      const env = { ...process.env, HOME: home };
      execFile("claude", ["auth", "status"], { timeout: 10_000, env }, (error, stdout, _stderr) => {
        // stdout만 파싱 — stderr 경고(.claude.json 없음 등)가 JSON을 깨뜨리지 않도록
        const clean_stdout = (stdout || "").trim();

        const json = try_parse_json(clean_stdout);
        if (json) {
          const logged_in = json.loggedIn === true || json.loggedin === true;
          const account = (json.email ?? json.account ?? null) as string | null;
          resolve({
            cli: "claude",
            authenticated: logged_in,
            account: account ?? undefined,
            error: logged_in ? undefined : "not logged in",
          });
          return;
        }

        if (error) {
          resolve({ cli: "claude", authenticated: false, error: clean_stdout || error.message });
          return;
        }

        resolve({ cli: "claude", authenticated: true, account: extract_account(clean_stdout) ?? undefined });
      });
    });
  }

  // ── Codex CLI ──────────────────────────────────────────────────────────────

  /** Codex는 auth status 명령이 없음. ~/.codex/ 디렉토리 내 인증 파일 존재 확인. */
  private check_codex(): CliAuthStatus {
    const codex_dir = join(this.agents_home, ".codex");

    if (!existsSync(codex_dir)) {
      return { cli: "codex", authenticated: false, error: "~/.codex/ not found" };
    }

    // auth 관련 파일 탐색 (auth.json, config.json, credentials 등)
    let files: string[];
    try { files = readdirSync(codex_dir); }
    catch { return { cli: "codex", authenticated: false, error: "cannot read ~/.codex/" }; }

    const auth_file = files.find(f =>
      f.includes("auth") || f.includes("credential") || f.includes("token"),
    );

    if (auth_file) {
      return { cli: "codex", authenticated: true, account: `~/.codex/${auth_file}` };
    }

    // config 파일이라도 있으면 인증된 것으로 간주 (API 키 기반일 수 있음)
    if (files.some(f => f.includes("config") || f.endsWith(".json"))) {
      return { cli: "codex", authenticated: true, account: "config detected" };
    }

    return { cli: "codex", authenticated: false, error: "no auth files in ~/.codex/" };
  }

  // ── Gemini CLI ──────────────────────────────────────────────────────────

  /** ~/.gemini/ 디렉토리 내 인증 파일 또는 GEMINI_API_KEY 환경변수 확인. */
  private check_gemini(): CliAuthStatus {
    // 환경변수 우선 확인
    if (process.env.GEMINI_API_KEY) {
      return { cli: "gemini", authenticated: true, account: "GEMINI_API_KEY" };
    }

    const gemini_dir = join(this.agents_home, ".gemini");

    if (!existsSync(gemini_dir)) {
      return { cli: "gemini", authenticated: false, error: "~/.gemini/ not found" };
    }

    let files: string[];
    try { files = readdirSync(gemini_dir); }
    catch { return { cli: "gemini", authenticated: false, error: "cannot read ~/.gemini/" }; }

    const auth_file = files.find(f =>
      f.includes("auth") || f.includes("credential") || f.includes("token") || f.includes("oauth"),
    );

    if (auth_file) {
      return { cli: "gemini", authenticated: true, account: `~/.gemini/${auth_file}` };
    }

    if (files.some(f => f.includes("config") || f.endsWith(".json"))) {
      return { cli: "gemini", authenticated: true, account: "config detected" };
    }

    return { cli: "gemini", authenticated: false, error: "no auth files in ~/.gemini/" };
  }
}

// ── 헬퍼 ───────────────────────────────────────────────────────────────────────

function try_parse_json(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { return null; }
}

/** stdout에서 계정 정보(이메일 등) 추출 시도. */
function extract_account(output: string): string | null {
  const email_match = output.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (email_match) return email_match[0];

  const first_line = output.split("\n")[0]?.trim();
  if (first_line && first_line.length < 100) return first_line;

  return null;
}
