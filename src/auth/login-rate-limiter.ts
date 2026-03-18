/**
 * H-8: 로그인 brute-force 방어 — IP 기반 슬라이딩 윈도우 rate limiter.
 *
 * 메모리 기반. 재시작 시 초기화됨 (셀프 호스팅 환경에서 충분).
 */

/** rate limit 설정. */
export type LoginRateLimitConfig = {
  /** 윈도우당 최대 시도 횟수. 기본 5. */
  max_attempts?: number;
  /** 윈도우 크기 (ms). 기본 15분. */
  window_ms?: number;
  /** GC 주기 — 몇 번 check 호출마다 만료 항목을 정리할지. 기본 100. */
  gc_interval?: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15분
const DEFAULT_GC_INTERVAL = 100;

export class LoginRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly max_attempts: number;
  private readonly window_ms: number;
  private readonly gc_interval: number;
  private check_count = 0;

  constructor(config?: LoginRateLimitConfig) {
    this.max_attempts = config?.max_attempts ?? DEFAULT_MAX_ATTEMPTS;
    this.window_ms = config?.window_ms ?? DEFAULT_WINDOW_MS;
    this.gc_interval = config?.gc_interval ?? DEFAULT_GC_INTERVAL;
  }

  /**
   * 시도 기록 + 허용 여부 반환.
   * @returns true면 허용, false면 차단 (429 응답 필요).
   */
  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.window_ms;
    let timestamps = this.buckets.get(key);

    if (timestamps) {
      // 윈도우 밖 항목 제거
      timestamps = timestamps.filter((t) => t > cutoff);
    } else {
      timestamps = [];
    }

    if (timestamps.length >= this.max_attempts) {
      this.buckets.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);

    // 주기적 GC — 오래된 키 정리
    this.check_count++;
    if (this.check_count % this.gc_interval === 0) this.gc();

    return true;
  }

  /** 남은 시도 횟수. */
  remaining(key: string): number {
    const cutoff = Date.now() - this.window_ms;
    const timestamps = this.buckets.get(key);
    if (!timestamps) return this.max_attempts;
    const recent = timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, this.max_attempts - recent);
  }

  /** 다음 시도 가능 시각까지 남은 ms. 0이면 즉시 가능. */
  retry_after_ms(key: string): number {
    const now = Date.now();
    const cutoff = now - this.window_ms;
    const timestamps = this.buckets.get(key);
    if (!timestamps) return 0;
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length < this.max_attempts) return 0;
    const oldest = Math.min(...recent);
    return Math.max(0, oldest + this.window_ms - now);
  }

  private gc(): void {
    const cutoff = Date.now() - this.window_ms;
    for (const [key, timestamps] of this.buckets) {
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) {
        this.buckets.delete(key);
      } else {
        this.buckets.set(key, recent);
      }
    }
  }
}
