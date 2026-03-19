/**
 * LF-5: Local-First Ops Defaults — 로컬 운영 기본값 명시.
 *
 * local-first 운영 환경을 위한 기본값을 코드로 고정.
 * 미래 클라우드 이식성을 막는 하드코드가 아닌 — 명시적 기본값 문서화.
 *
 * 기본값 우선순위:
 *   vault > config store override > local defaults (이 파일) > 코드 기본값
 */

/** local-first 바인딩 설정. */
export type LocalBindConfig = {
  /** 대시보드 바인드 주소 — 로컬은 0.0.0.0 (모든 인터페이스). */
  host: string;
  /** 대시보드 포트 — 로컬 기본값 4200. */
  port: number;
  /** 포트 충돌 시 자동 대체 포트 사용. */
  port_fallback: boolean;
};

/** local-first GPU 설정 — 로컬 Ollama/vLLM 실행 가정. */
export type LocalGpuConfig = {
  /** GPU 가속 활성화 여부. 로컬은 GPU 있으면 항상 활성화. */
  enabled: boolean;
  /** GPU 관련 컨테이너 인수 목록. */
  args: readonly string[];
};

/** local-first Redis 설정 — 로컬 컨테이너 기반. */
export type LocalRedisConfig = {
  /** Redis URL — 로컬 컨테이너 기본값. */
  url: string;
  /** 키 prefix — 로컬 환경 격리. */
  key_prefix: string;
};

/** local-first worker 기본값. */
export type LocalWorkerDefaults = {
  /** 인바운드 동시 처리 수 — 로컬은 CPU 코어 수 이하로 제한. */
  inbound_concurrency: number;
  /** 로컬 큐 포화 임계값 (0.0 ~ 1.0). */
  queue_saturation_threshold: number;
  /** 스케일 아웃 없이 로컬 큐만 사용하는지. */
  local_queue_only: boolean;
};

/** local-first 전체 운영 기본값. */
export type LocalOpsDefaults = {
  bind: LocalBindConfig;
  gpu: LocalGpuConfig;
  redis: LocalRedisConfig;
  worker: LocalWorkerDefaults;
};

/**
 * 로컬 운영 기본값.
 *
 * 이 값들은 config store override나 vault 값으로 교체 가능.
 * 클라우드 이식 시 이 값들을 환경별 config로 대체하면 됨.
 */
export const LOCAL_OPS_DEFAULTS: LocalOpsDefaults = {
  bind: {
    host: "0.0.0.0",
    port: 4200,
    port_fallback: false,
  },
  gpu: {
    enabled: true,
    args: [] as const,
  },
  redis: {
    url: "redis://redis:6379",
    key_prefix: "sf:bus:",
  },
  worker: {
    inbound_concurrency: 4,
    queue_saturation_threshold: 0.8,
    local_queue_only: false,
  },
} as const;

/**
 * AppConfig 부분 오버라이드에서 로컬 기본값을 병합.
 *
 * 지정된 필드는 유지하고 미지정 필드는 LOCAL_OPS_DEFAULTS로 채움.
 * config store나 vault에서 오버라이드된 값은 손대지 않음.
 */
export function merge_local_defaults(override: {
  dashboard?: Partial<{ port: number; host: string; portFallback: boolean }>;
  orchestratorLlm?: Partial<{ gpuEnabled: boolean; gpuArgs: string[] }>;
  bus?: Partial<{ redis: Partial<{ url: string; keyPrefix: string }> }>;
  channel?: Partial<{ inboundConcurrency: number }>;
}): {
  dashboard: { port: number; host: string; portFallback: boolean };
  orchestratorLlm: { gpuEnabled: boolean; gpuArgs: string[] };
  bus: { redis: { url: string; keyPrefix: string } };
  channel: { inboundConcurrency: number };
} {
  return {
    dashboard: {
      port: override.dashboard?.port ?? LOCAL_OPS_DEFAULTS.bind.port,
      host: override.dashboard?.host ?? LOCAL_OPS_DEFAULTS.bind.host,
      portFallback: override.dashboard?.portFallback ?? LOCAL_OPS_DEFAULTS.bind.port_fallback,
    },
    orchestratorLlm: {
      gpuEnabled: override.orchestratorLlm?.gpuEnabled ?? LOCAL_OPS_DEFAULTS.gpu.enabled,
      gpuArgs: override.orchestratorLlm?.gpuArgs ?? [...LOCAL_OPS_DEFAULTS.gpu.args],
    },
    bus: {
      redis: {
        url: override.bus?.redis?.url ?? LOCAL_OPS_DEFAULTS.redis.url,
        keyPrefix: override.bus?.redis?.keyPrefix ?? LOCAL_OPS_DEFAULTS.redis.key_prefix,
      },
    },
    channel: {
      inboundConcurrency: override.channel?.inboundConcurrency ?? LOCAL_OPS_DEFAULTS.worker.inbound_concurrency,
    },
  };
}
