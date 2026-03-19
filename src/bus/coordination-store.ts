/**
 * PA-5: CoordinationStore port — 분산 락/TTL 기반 코디네이션 저장소 추상화.
 *
 * 설계 원칙:
 * - "이벤트/릴레이/coordination은 별도 축으로 유지" (MessageBusLike와 병합 금지)
 * - port 이름이 concrete 구현 세부를 드러내면 안 됨 (메모리 아님 → CoordinationStoreLike)
 * - TTL 만료 + owner 검증 포함
 * - 클라우드 어댑터(Redis SETNX 등)는 FC-3 스코프
 */

/* ─── 타입 ─── */

/** 코디네이션 엔트리 — acquire 성공 시 반환. */
export interface CoordinationEntry {
  /** 리소스 식별자. */
  key: string;
  /** 소유자 식별자 (에이전트 ID, 워크플로우 run_id 등). */
  owner: string;
  /** 만료 시각 (Unix ms). */
  expires_at: number;
  /** ISO 8601 획득 시각. */
  acquired_at: string;
}

/**
 * CoordinationStore port 인터페이스.
 * 분산 락(distributed lock) + TTL 기반 리소스 점유 계약.
 */
export interface CoordinationStoreLike {
  /**
   * 리소스 락을 획득한다.
   * - 이미 다른 owner가 유효한 락을 보유 중이면 null 반환.
   * - 동일 owner의 재획득 → TTL 갱신 후 기존 엔트리 반환.
   * @param key 리소스 식별자
   * @param owner 소유자 식별자
   * @param ttl_ms TTL (밀리초)
   */
  acquire(key: string, owner: string, ttl_ms: number): Promise<CoordinationEntry | null>;

  /**
   * 리소스 락을 해제한다.
   * - owner가 일치하지 않으면 false 반환 (타인의 락 해제 방지).
   * - 이미 만료/없는 락 → false.
   */
  release(key: string, owner: string): Promise<boolean>;

  /**
   * 특정 키의 엔트리를 조회한다.
   * - 만료된 엔트리는 null 반환.
   */
  get(key: string): Promise<CoordinationEntry | null>;

  /**
   * 유효한(비만료) 엔트리 목록을 반환한다.
   * @param prefix 선택적 prefix 필터
   */
  list(prefix?: string): Promise<CoordinationEntry[]>;

  /**
   * 만료된 엔트리를 정리한다.
   * @returns 제거된 항목 수
   */
  sweep(): Promise<number>;
}

/* ─── 로컬 어댑터 ─── */

/** 내부 저장 레코드 (만료 포함). */
interface StoredEntry {
  entry: CoordinationEntry;
}

/**
 * 인메모리 CoordinationStore 로컬 어댑터.
 * 프로세스 재시작 시 상태 초기화 — 로컬/단일 프로세스 환경 전용.
 */
export class LocalCoordinationStore implements CoordinationStoreLike {
  /** 키 → 저장 레코드 맵. */
  private readonly store = new Map<string, StoredEntry>();

  async acquire(key: string, owner: string, ttl_ms: number): Promise<CoordinationEntry | null> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing) {
      const is_expired = existing.entry.expires_at <= now;
      if (!is_expired) {
        // 유효한 락이 존재
        if (existing.entry.owner === owner) {
          // 동일 owner → TTL 갱신
          existing.entry.expires_at = now + ttl_ms;
          return { ...existing.entry };
        }
        // 타인 소유 → 획득 실패
        return null;
      }
      // 만료된 락 → 덮어쓰기 허용
    }

    const entry: CoordinationEntry = {
      key,
      owner,
      expires_at: now + ttl_ms,
      acquired_at: new Date().toISOString(),
    };
    this.store.set(key, { entry });
    return { ...entry };
  }

  async release(key: string, owner: string): Promise<boolean> {
    const existing = this.store.get(key);
    if (!existing) return false;

    const now = Date.now();
    if (existing.entry.expires_at <= now) {
      // 이미 만료 → 제거 후 false
      this.store.delete(key);
      return false;
    }

    if (existing.entry.owner !== owner) {
      // 소유자 불일치 → 해제 거부
      return false;
    }

    this.store.delete(key);
    return true;
  }

  async get(key: string): Promise<CoordinationEntry | null> {
    const existing = this.store.get(key);
    if (!existing) return null;

    const now = Date.now();
    if (existing.entry.expires_at <= now) {
      this.store.delete(key);
      return null;
    }

    return { ...existing.entry };
  }

  async list(prefix?: string): Promise<CoordinationEntry[]> {
    const now = Date.now();
    const results: CoordinationEntry[] = [];

    for (const [key, stored] of this.store.entries()) {
      if (stored.entry.expires_at <= now) continue; // 만료 제외
      if (prefix && !key.startsWith(prefix)) continue;
      results.push({ ...stored.entry });
    }

    return results;
  }

  async sweep(): Promise<number> {
    const now = Date.now();
    let removed = 0;

    for (const [key, stored] of this.store.entries()) {
      if (stored.entry.expires_at <= now) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/* ─── 팩토리 ─── */

/**
 * 인메모리 CoordinationStore를 생성한다.
 * 로컬/단일 프로세스 환경 전용.
 */
export function create_local_coordination_store(): CoordinationStoreLike {
  return new LocalCoordinationStore();
}
