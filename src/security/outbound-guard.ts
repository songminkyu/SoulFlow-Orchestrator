/**
 * IC-1: OutboundRequestGuard port.
 * allowlist/trust-zone 기반 아웃바운드 HTTP 요청 검증 경계.
 */

/** SH-2 OutboundRequestGuard port interface. */
export interface OutboundRequestGuardLike {
  /** URL이 허용 목록에 포함되는지 검증. */
  is_allowed(url: string): boolean;
  /** 현재 trust zone 문자열 반환. */
  get_trust_zone(): string;
  /** 허용된 호스트 목록 반환 (읽기 전용). */
  get_allowed_hosts(): readonly string[];
}

/** factory 파라미터: config의 allowlist + zone. */
export interface OutboundGuardConfig {
  /** 허용된 호스트명 목록. 빈 배열이면 모든 외부 요청 차단. */
  allowed_hosts?: readonly string[];
  /** trust zone 식별자 (예: "internal", "private", "public"). 기본값: "internal". */
  trust_zone?: string;
}

/**
 * config에서 allowlist를 읽어 OutboundRequestGuardLike 인스턴스 생성.
 * check_allowed_hosts와 동일한 검증 로직 사용.
 */
export function create_outbound_guard(config?: OutboundGuardConfig): OutboundRequestGuardLike {
  const allowed_hosts: readonly string[] = Array.isArray(config?.allowed_hosts)
    ? (config!.allowed_hosts as unknown[]).map(String).filter(Boolean)
    : [];
  const trust_zone = config?.trust_zone ?? "internal";

  return {
    is_allowed(url: string): boolean {
      if (allowed_hosts.length === 0) return false;
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
        return allowed_hosts.includes(hostname);
      } catch {
        return false;
      }
    },

    get_trust_zone(): string {
      return trust_zone;
    },

    get_allowed_hosts(): readonly string[] {
      return allowed_hosts;
    },
  };
}

/**
 * OAuth integration settings から guard 생성 편의 함수.
 * OAuthFetchTool / orchestration.ts의 check_allowed_hosts 경로를 통합하는 factory.
 */
export function create_guard_from_integration_settings(
  settings: { allowed_hosts?: unknown[] } | undefined,
  trust_zone?: string,
): OutboundRequestGuardLike {
  const hosts: string[] = Array.isArray(settings?.allowed_hosts)
    ? (settings!.allowed_hosts as unknown[]).map(String).filter(Boolean)
    : [];
  return create_outbound_guard({ allowed_hosts: hosts, trust_zone });
}
