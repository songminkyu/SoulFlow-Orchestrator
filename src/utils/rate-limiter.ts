/**
 * 슬라이딩 윈도우 카운터 기반 rate limiter.
 * key(user, IP 등)별로 윈도우 내 요청 수를 추적하고 제한한다.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; window_start_ms: number }>();
  private last_cleanup: number;

  constructor(
    private readonly limit: number,
    private readonly window_ms: number,
    private readonly cleanup_interval_ms: number,
  ) {
    this.last_cleanup = Date.now();
  }

  /** key에 대한 rate check. true = 허용, false = 초과. */
  check(key: string): boolean {
    const now = Date.now();
    if (now - this.last_cleanup > this.cleanup_interval_ms) {
      for (const [k, v] of this.hits) {
        if (now - v.window_start_ms > this.window_ms) this.hits.delete(k);
      }
      this.last_cleanup = now;
    }
    const entry = this.hits.get(key);
    if (!entry || now - entry.window_start_ms >= this.window_ms) {
      this.hits.set(key, { count: 1, window_start_ms: now });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count++;
    return true;
  }

  /** 429 응답의 Retry-After 값 (초). 윈도우 만료까지 남은 실제 시간. */
  retry_after_sec(key: string): number {
    const entry = this.hits.get(key);
    if (!entry) return 0;
    const remaining_ms = Math.max(0, entry.window_start_ms + this.window_ms - Date.now());
    return Math.ceil(remaining_ms / 1000);
  }
}
