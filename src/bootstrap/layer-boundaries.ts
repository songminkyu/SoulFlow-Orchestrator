/**
 * LF-1: 레이어 경계 코드화 (Layer Boundary Codification)
 *
 * 플랫폼 레이어를 타입과 상수로 고정. 런타임이 아닌 설계 계약.
 * 레이어 간 의존 방향: ingress → gateway → execution → worker → delivery → state → observability
 *
 * 규칙:
 *   - 레이어는 하위(숫자 작은 쪽) → 상위(숫자 큰 쪽)로만 의존 가능
 *   - 같은 레이어 간 직접 참조는 허용 (수평 협력)
 *   - 역방향 참조는 포트(interface)로만 허용
 */

/** 플랫폼 레이어 식별자. 의존 순서를 숫자로 표현. */
export type LayerId =
  | "ingress"        // 0: 채널 진입 (Slack, Discord, Web, CLI)
  | "gateway"        // 1: 분류/라우팅 결정 (classifier, gateway)
  | "execution"      // 2: LLM 실행 (once, agent, task, phase)
  | "worker"         // 3: 비동기 작업 (cron, kanban, 생성 태스크)
  | "delivery"       // 4: 응답 전달 (outbound bus, SSE broadcaster)
  | "state"          // 5: 영속 상태 (SQLite, Redis, sessions)
  | "observability"; // 6: 관찰 (logs, metrics, traces)

/** 레이어 의존 순서 — 낮은 숫자가 더 기반 레이어. */
export const LAYER_ORDER: Record<LayerId, number> = {
  ingress: 0,
  gateway: 1,
  execution: 2,
  worker: 3,
  delivery: 4,
  state: 5,
  observability: 6,
} as const;

/** 레이어 소유 경계 — 각 레이어가 담당하는 모듈 경로 패턴. */
export const LAYER_OWNERSHIP: Record<LayerId, readonly string[]> = {
  ingress: ["src/channels/", "src/bootstrap/channels.ts"],
  gateway: ["src/orchestration/gateway", "src/orchestration/classifier"],
  execution: ["src/orchestration/execution/", "src/agent/"],
  worker: ["src/cron/", "src/services/kanban-store", "src/orchestration/worker-dispatch"],
  delivery: ["src/dashboard/broadcaster", "src/bus/ports"],
  state: ["src/bus/", "src/config/", "src/security/", "src/services/"],
  observability: ["src/observability/", "src/logger"],
} as const;

/** 레이어 경계 설명 — 공통 용어 합의. */
export const LAYER_DESCRIPTIONS: Record<LayerId, string> = {
  ingress: "채널 메시지 수신, 인증, 역할 확인, 디스패치 진입",
  gateway: "의도 분류, 실행 경로 결정, cost-tier 결정",
  execution: "LLM 호출, 도구 실행, 에이전트 루프",
  worker: "비동기 작업 스케줄링, inline/local-queue/remote-queue 분기",
  delivery: "응답 직렬화, 채널 전달, SSE 브로드캐스트",
  state: "영속 저장소 읽기/쓰기, 캐시, 세션 관리",
  observability: "로그, 메트릭, 분산 추적",
} as const;

/** 레이어 소속 주석 — 파일 상단에 부착해 경계를 명시화. */
export type LayerAnnotation = {
  /** 이 모듈이 속한 레이어. */
  layer: LayerId;
  /** 이 모듈이 허용하는 의존 레이어 목록. 미지정 시 하위 레이어 전체 허용. */
  allowed_deps?: readonly LayerId[];
  /** 경계 위반 시 표시할 메시지. */
  boundary_note?: string;
};

/**
 * 레이어 주석 팩토리. 경계를 명시적으로 선언할 때 사용.
 *
 * @example
 * // src/orchestration/worker-dispatch.ts
 * export const LAYER: LayerAnnotation = layer_annotation({
 *   layer: "worker",
 *   boundary_note: "worker → execution 방향만 허용. ingress 직접 참조 금지.",
 * });
 */
export function layer_annotation(annotation: LayerAnnotation): LayerAnnotation {
  return annotation;
}

/**
 * 두 레이어 간 의존이 허용되는지 검사.
 * from_layer → to_layer 방향이 허용 규칙을 따르는지 확인.
 *
 * 규칙: from_layer 숫자 >= to_layer 숫자 (상위 레이어가 하위를 참조)
 * 예외: observability는 어느 레이어도 참조할 수 있음 (cross-cutting)
 */
export function is_dependency_allowed(from_layer: LayerId, to_layer: LayerId): boolean {
  // observability는 횡단 관심사 — 어느 방향도 허용
  if (from_layer === "observability") return true;
  // 상위 레이어(숫자 큰)가 하위 레이어(숫자 작은)를 참조하는 것이 올바른 방향
  return LAYER_ORDER[from_layer] >= LAYER_ORDER[to_layer];
}
