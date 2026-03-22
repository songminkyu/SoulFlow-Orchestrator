/**
 * SkillIndex — FTS5 기반 4차원 스킬 매처.
 * AgentDomain.recommend_skills() 구현을 교체.
 * 인메모리 SQLite DB를 사용. 전역 singleton 금지 (주입형).
 */

import { open_sqlite } from "../utils/sqlite-helper.js";
import type { DatabaseSync } from "../utils/sqlite-helper.js";
import type { SkillMetadata } from "../agent/skills.types.js";
import { extract_intents, extract_file_extensions, extract_code_hints } from "./intent-patterns.js";
import type { SemanticScorerPort } from "./semantic-scorer-port.js";
import { apply_semantic_deltas } from "./semantic-scorer-port.js";

export interface SkillIndexEntry {
  name: string;
  triggers: string;
  aliases: string;
  summary: string;
  intents: string;
  file_pats: string;
  code_pats: string;
}

export interface SkillSelectOptions {
  /** 파일 확장자 힌트. 없으면 task 텍스트에서 자동 추출. */
  file_hints?: string[];
  /** 코드 키워드 힌트. 없으면 task 텍스트에서 자동 추출. */
  code_hints?: string[];
}

export class SkillIndex {
  /** ":memory:" — 인메모리 DB. 스킬 목록이 변경되면 rebuild() 호출. */
  private readonly db_path = ":memory:";
  private built = false;

  /** SQLite DB 핸들. 인메모리이므로 open_sqlite로 열고 인스턴스로 유지. */
  private readonly db: DatabaseSync;

  /** K4: optional 시멘틱 scorer. null이면 FTS5/BM25 동작 그대로 유지. */
  private semantic_scorer: SemanticScorerPort | null = null;

  constructor() {
    this.db = open_sqlite(this.db_path);
    this._init_schema();
  }

  private _init_schema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skill_docs (
        rowid  INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        triggers   TEXT NOT NULL DEFAULT '',
        aliases    TEXT NOT NULL DEFAULT '',
        summary    TEXT NOT NULL DEFAULT '',
        intents    TEXT NOT NULL DEFAULT '',
        file_pats  TEXT NOT NULL DEFAULT '',
        code_pats  TEXT NOT NULL DEFAULT ''
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name, triggers, aliases, summary, intents, file_pats, code_pats,
        content='skill_docs', content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );
    `);
  }

  /** 스킬 목록으로 인덱스 재구축. */
  build(skills: SkillMetadata[]): void {
    this.db.exec("DELETE FROM skill_docs; DELETE FROM skills_fts;");

    const insert = this.db.prepare(`
      INSERT INTO skill_docs (name, triggers, aliases, summary, intents, file_pats, code_pats)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const fts_insert = this.db.prepare(`
      INSERT INTO skills_fts (rowid, name, triggers, aliases, summary, intents, file_pats, code_pats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const s of skills) {
        if (s.type === "role") continue;
        const info = insert.run(
          s.name,
          s.triggers.join(" "),
          s.aliases.join(" "),
          s.summary,
          s.intents.join(" "),
          s.file_patterns.join(" "),
          s.code_patterns.join(" "),
        );
        fts_insert.run(info.lastInsertRowid, s.name, s.triggers.join(" "), s.aliases.join(" "), s.summary, s.intents.join(" "), s.file_patterns.join(" "), s.code_patterns.join(" "));
      }
    });
    tx();
    this.built = true;
  }

  /** 마지막 select() 호출의 BM25+보너스 점수. select_async()에서 semantic delta 가산 기저로 사용. */
  private _last_scores = new Map<string, number>();

  /** 4차원 스코어링으로 스킬 선택. */
  select(task: string, options: SkillSelectOptions = {}, limit = 6): string[] {
    if (!this.built) return [];
    const max = Math.max(1, Math.min(20, limit));

    // 추출된 힌트
    const intents = extract_intents(task);
    const file_hints = options.file_hints ?? extract_file_extensions(task);
    const code_hints = options.code_hints ?? extract_code_hints(task);

    // FTS5 BM25 기반 키워드 매칭
    const fts_query = task.trim().replace(/["']/g, " ").slice(0, 200);
    const scored = new Map<string, number>();

    if (fts_query.length >= 2) {
      try {
        const rows = this.db.prepare(`
          SELECT sd.name, bm25(skills_fts) AS score
          FROM skills_fts sf
          JOIN skill_docs sd ON sd.rowid = sf.rowid
          WHERE skills_fts MATCH ?
          ORDER BY score
          LIMIT 50
        `).all(fts_query) as Array<{ name: string; score: number }>;

        for (const row of rows) {
          // BM25는 음수값 (낮을수록 좋음), 양수로 변환
          scored.set(row.name, (scored.get(row.name) ?? 0) + Math.abs(row.score) * 2);
        }
      } catch {
        // FTS5 쿼리 파싱 오류 무시
      }
    }

    // Alias/Trigger/Intent 직접 포함 보너스 — FTS5 unicode61이 한국어 단어 경계를 못 잡는 문제 보완.
    // 스킬 작성자가 명시한 키워드가 task 텍스트에 그대로 포함되면 최우선 선택.
    {
      const lower_task = task.toLowerCase();
      const keyword_rows = this.db.prepare(
        `SELECT name, aliases, triggers FROM skill_docs WHERE aliases != '' OR triggers != ''`
      ).all() as Array<{ name: string; aliases: string; triggers: string }>;

      for (const row of keyword_rows) {
        let bonus = 0;
        // alias 직접 포함: +10 (가장 명시적인 대응 키워드)
        const aliases = row.aliases.split(/\s+/).filter((a) => a.length >= 2);
        if (aliases.some((a) => lower_task.includes(a.toLowerCase()))) bonus += 10;
        // trigger 직접 포함: +8
        const triggers = row.triggers.split(/\s+/).filter((t) => t.length >= 2);
        if (triggers.some((t) => lower_task.includes(t.toLowerCase()))) bonus += 8;
        if (bonus > 0) scored.set(row.name, (scored.get(row.name) ?? 0) + bonus);
      }
    }

    // Intent 보너스 (+3/match)
    if (intents.length > 0) {
      const rows = this.db.prepare(
        `SELECT name, intents FROM skill_docs WHERE intents != ''`
      ).all() as Array<{ name: string; intents: string }>;

      for (const row of rows) {
        const row_intents = row.intents.split(/\s+/);
        const hits = intents.filter((i) => row_intents.includes(i)).length;
        if (hits > 0) scored.set(row.name, (scored.get(row.name) ?? 0) + hits * 3);
      }
    }

    // File pattern 보너스 (+4/match)
    if (file_hints.length > 0) {
      const rows = this.db.prepare(
        `SELECT name, file_pats FROM skill_docs WHERE file_pats != ''`
      ).all() as Array<{ name: string; file_pats: string }>;

      for (const row of rows) {
        const pats = row.file_pats.toLowerCase().split(/\s+/);
        const hits = file_hints.filter((h) => pats.some((p) => p.includes(h.replace("*.", ".")) || h.includes(p.replace("*.", ".")))).length;
        if (hits > 0) scored.set(row.name, (scored.get(row.name) ?? 0) + hits * 4);
      }
    }

    // Code pattern 보너스 (+3/match)
    if (code_hints.length > 0) {
      const rows = this.db.prepare(
        `SELECT name, code_pats FROM skill_docs WHERE code_pats != ''`
      ).all() as Array<{ name: string; code_pats: string }>;

      for (const row of rows) {
        const pats = row.code_pats.toLowerCase().split(/\s+/);
        const hits = code_hints.filter((h) => pats.includes(h.toLowerCase())).length;
        if (hits > 0) scored.set(row.name, (scored.get(row.name) ?? 0) + hits * 3);
      }
    }

    const sorted = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
    this._last_scores = new Map(sorted);
    return sorted.map(([name]) => name);
  }

  /**
   * K4: 시멘틱 scorer 포트 주입.
   * - null 주입 시 no-op으로 복귀 (기존 FTS5 동작 보존).
   * - HybridPolicySemanticScorer를 주입하면 TR-3 RRF/MMR 파이프라인 활성화.
   */
  set_semantic_scorer(scorer: SemanticScorerPort | null): void {
    this.semantic_scorer = scorer;
  }

  /**
   * K4: 시멘틱 보강 포함 스킬 선택 (async 경로).
   *
   * select()와 동일한 FTS5 + 4차원 스코어링을 수행한 후,
   * semantic_scorer가 주입된 경우 delta 재점수를 추가로 적용.
   *
   * - scorer가 없으면 select()와 완전히 동일한 결과 반환.
   * - scorer 오류 시 FTS5 결과로 폴백.
   *
   * 기존 sync select()를 대체하지 않으며, 필요한 경우에만 select_async()로 업그레이드.
   */
  async select_async(task: string, options: SkillSelectOptions = {}, limit = 6): Promise<string[]> {
    const sync_results = this.select(task, options, limit);

    if (this.semantic_scorer === null || sync_results.length === 0) {
      return sync_results;
    }

    try {
      const deltas = await this.semantic_scorer.score(task, sync_results);
      if (deltas.length === 0) return sync_results;

      // BM25+보너스 점수를 기저로 사용 (select()에서 캐시된 실제 점수)
      const base_scores = new Map<string, number>(sync_results.map((n) => [n, this._last_scores.get(n) ?? 1.0]));
      const boosted = apply_semantic_deltas(base_scores, deltas);
      return [...boosted.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name);
    } catch {
      // scorer 오류 시 FTS5 결과 그대로 반환
      return sync_results;
    }
  }

  get is_built(): boolean {
    return this.built;
  }

  /** DB 연결 정리. */
  close(): void {
    try { this.db.close(); } catch { /* noop */ }
  }
}
