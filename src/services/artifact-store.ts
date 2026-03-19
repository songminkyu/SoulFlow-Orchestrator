/**
 * PA-5: ArtifactStore port — 런 아티팩트(파일/바이너리) 저장소 추상화.
 *
 * 설계 원칙:
 * - "모든 storage를 하나의 mega-port로 합치지 않는다"
 * - port 이름이 concrete 구현 세부를 드러내면 안 됨 (로컬 FS 아님 → ArtifactStoreLike)
 * - 클라우드 어댑터(S3, GCS 등)는 FC-2/FC-3 스코프 — 여기서는 로컬 전용 구현만 포함
 */

import { mkdir, writeFile, readFile, stat, readdir, unlink } from "node:fs/promises";
import { join, dirname, sep as path_sep } from "node:path";

/* ─── 타입 ─── */

/** 아티팩트 메타데이터 — put/stat 반환값. */
export interface ArtifactMeta {
  /** 키: `{run_id}/{name}` 형식. */
  key: string;
  /** 바이트 단위 크기. */
  size: number;
  /** ISO 8601 생성 시각. */
  created_at: string;
}

/**
 * ArtifactStore port 인터페이스.
 * 구현 세부(로컬 FS, S3 등)를 드러내지 않는 순수 추상 계약.
 */
export interface ArtifactStoreLike {
  /** 아티팩트를 저장한다. 동일 키 → 덮어쓰기. */
  put(key: string, data: Buffer | Uint8Array | string): Promise<ArtifactMeta>;

  /** 아티팩트를 로드한다. 존재하지 않으면 null 반환. */
  get(key: string): Promise<Buffer | null>;

  /** 아티팩트 메타데이터를 조회한다. 존재하지 않으면 null 반환. */
  stat(key: string): Promise<ArtifactMeta | null>;

  /**
   * prefix 하위 아티팩트 목록을 반환한다.
   * prefix 미지정 시 전체 목록.
   */
  list(prefix?: string): Promise<ArtifactMeta[]>;

  /** 아티팩트를 삭제한다. 존재하지 않아도 에러 없음. */
  delete(key: string): Promise<void>;
}

/* ─── 헬퍼 ─── */

/** 키에서 로컬 파일 경로를 계산한다. */
function key_to_path(root: string, key: string): string {
  // 디렉터리 순회 공격 방지: `..` 세그먼트 제거
  const safe_key = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return join(root, safe_key);
}

/** 현재 시각의 ISO 8601 문자열. */
function iso_now(): string {
  return new Date().toISOString();
}

/* ─── 로컬 어댑터 ─── */

/**
 * 파일시스템 기반 ArtifactStore 로컬 어댑터.
 * 아티팩트는 `{root}/{key}` 경로에 저장됨.
 */
export class LocalArtifactStore implements ArtifactStoreLike {
  /** 아티팩트 루트 디렉터리 (절대 경로). */
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async put(key: string, data: Buffer | Uint8Array | string): Promise<ArtifactMeta> {
    const file_path = key_to_path(this.root, key);
    await mkdir(dirname(file_path), { recursive: true });
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    await writeFile(file_path, buf);
    return {
      key,
      size: buf.byteLength,
      created_at: iso_now(),
    };
  }

  async get(key: string): Promise<Buffer | null> {
    const file_path = key_to_path(this.root, key);
    try {
      return await readFile(file_path);
    } catch {
      return null;
    }
  }

  async stat(key: string): Promise<ArtifactMeta | null> {
    const file_path = key_to_path(this.root, key);
    try {
      const s = await stat(file_path);
      return {
        key,
        size: s.size,
        created_at: s.birthtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async list(prefix?: string): Promise<ArtifactMeta[]> {
    const scan_root = prefix
      ? key_to_path(this.root, prefix)
      : this.root;

    const results: ArtifactMeta[] = [];
    await this._scan(scan_root, this.root, results);
    return results;
  }

  async delete(key: string): Promise<void> {
    const file_path = key_to_path(this.root, key);
    try {
      await unlink(file_path);
    } catch {
      // 파일이 없어도 성공으로 처리
    }
  }

  /** 디렉터리를 재귀 스캔하여 파일 메타 수집. */
  private async _scan(dir: string, root: string, out: ArtifactMeta[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // 디렉터리 없음 → 빈 목록
    }

    for (const entry of entries) {
      const full_path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this._scan(full_path, root, out);
      } else if (entry.isFile()) {
        try {
          const s = await stat(full_path);
          // 루트 기준 상대 경로를 키로 사용 (path.posix.relative 사용으로 플랫폼 독립)
          const rel = full_path.slice(root.length).split(path_sep).join("/").replace(/^\//, "");
          out.push({
            key: rel,
            size: s.size,
            created_at: s.birthtime.toISOString(),
          });
        } catch {
          // stat 실패 무시
        }
      }
    }
  }
}

/* ─── 팩토리 ─── */

/**
 * 로컬 파일시스템 ArtifactStore를 생성한다.
 * @param root 아티팩트 루트 디렉터리 (절대 경로)
 */
export function create_local_artifact_store(root: string): ArtifactStoreLike {
  return new LocalArtifactStore(root);
}
