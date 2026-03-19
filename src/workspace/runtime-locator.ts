/**
 * FC-4: RuntimeLocator port + local adapter.
 *
 * 설계 원칙:
 * - WorkspaceRuntimeLocator (TN-2, registry.ts)는 per-user workspace 관리 포트.
 * - RuntimeLocator (FC-4)는 더 상위 개념: 실행 환경 자체를 추상화.
 *   "이 작업이 어느 런타임에서 실행되어야 하는가"를 결정하는 포트.
 * - cloud adapter는 원격 컨테이너/함수 런타임을 대상으로 할 수 있다.
 * - LocalRuntimeLocator: 동일 프로세스 내 실행 (기본값).
 */

import type { ExecutionTarget } from "../config/portability.js";

/* ─── 타입 ─── */

/**
 * RuntimeDescriptor — 런타임 환경 서술자.
 * 로케이터가 반환하는 "실행 가능한 런타임"의 추상 표현.
 */
export interface RuntimeDescriptor {
  /** 런타임 고유 식별자. */
  id: string;
  /** 실행 환경 종류. */
  target: ExecutionTarget;
  /**
   * 런타임 엔드포인트.
   * - `local`: undefined (동일 프로세스)
   * - `subprocess`: 프로세스 실행 경로
   * - `container`: 컨테이너 이름 또는 소켓 경로
   * - `cloud_fn`: 함수 ARN/URL
   * - `remote_rpc`: gRPC/HTTP 엔드포인트 URL
   */
  endpoint?: string;
  /** 런타임이 현재 가용한지 여부. */
  available: boolean;
  /** 런타임 레이블 (사람이 읽을 수 있는 이름). */
  label?: string;
  /** 추가 런타임 속성 (target별 특수 설정). */
  metadata?: Record<string, unknown>;
}

/**
 * RuntimeLocatorLike — 실행 환경 탐색 포트.
 *
 * 구현 요구사항:
 * - `resolve`: 작업 ID로 적합한 런타임을 반환. 없으면 null.
 * - `list_available`: 현재 사용 가능한 런타임 목록 반환.
 * - `health_check`: 특정 런타임 상태 확인.
 *
 * Cloud adapter 구현 시 고려사항:
 * - `resolve`는 부하 분산 정책을 포함할 수 있음.
 * - `list_available`은 클러스터 상태를 반영해야 함.
 * - `health_check`는 원격 엔드포인트를 ping해야 함.
 */
export interface RuntimeLocatorLike {
  /**
   * 주어진 실행 타겟에 적합한 런타임 서술자를 반환한다.
   * @param target 요청 실행 환경
   * @param hint 선호 런타임 ID (선택적)
   * @returns 사용 가능한 런타임. 없으면 null.
   */
  resolve(target: ExecutionTarget, hint?: string): Promise<RuntimeDescriptor | null>;

  /**
   * 현재 사용 가능한 런타임 목록을 반환한다.
   * @param target 특정 타겟으로 필터 (미지정 시 전체)
   */
  list_available(target?: ExecutionTarget): Promise<RuntimeDescriptor[]>;

  /**
   * 특정 런타임의 상태를 확인한다.
   * @param runtime_id 확인할 런타임 ID
   * @returns 가용 여부
   */
  health_check(runtime_id: string): Promise<boolean>;
}

/* ─── 로컬 어댑터 ─── */

/** 로컬 런타임 설명자 (고정값). */
const LOCAL_RUNTIME: RuntimeDescriptor = {
  id: "local",
  target: "local",
  available: true,
  label: "Local In-Process Runtime",
};

/**
 * LocalRuntimeLocator — 로컬 인프로세스 RuntimeLocator 구현.
 *
 * 항상 `local` 타겟을 반환한다. 단일 프로세스 환경 전용.
 * cloud adapter (Kubernetes, Lambda 등)로 교체 가능한 구조를 유지한다.
 */
export class LocalRuntimeLocator implements RuntimeLocatorLike {
  async resolve(target: ExecutionTarget, _hint?: string): Promise<RuntimeDescriptor | null> {
    // 로컬 어댑터는 `local` 타겟만 지원
    if (target !== "local") return null;
    return { ...LOCAL_RUNTIME };
  }

  async list_available(target?: ExecutionTarget): Promise<RuntimeDescriptor[]> {
    if (target !== undefined && target !== "local") return [];
    return [{ ...LOCAL_RUNTIME }];
  }

  async health_check(runtime_id: string): Promise<boolean> {
    // 로컬 런타임은 항상 가용
    return runtime_id === "local";
  }
}

/* ─── 팩토리 ─── */

/**
 * 로컬 RuntimeLocator를 생성한다.
 * cloud adapter로 교체 시 이 함수를 대체한다.
 */
export function create_local_runtime_locator(): RuntimeLocatorLike {
  return new LocalRuntimeLocator();
}
