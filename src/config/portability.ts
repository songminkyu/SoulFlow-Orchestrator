/**
 * FC-1: ExecutionTarget / JobDispatchMode — 실행 토폴로지 열거형.
 * FC-5: deployment_kind / trust_zone / egress_required — 배포 메타데이터.
 *
 * 설계 원칙:
 * - 실제 cloud adapter 구현은 이 파일에 포함하지 않음 (FC-2/FC-3 스코프)
 * - 이 파일은 "어디서 실행되는가"를 서술하는 순수 타입/상수 계층
 * - 런타임이 이 값을 읽어 adapter를 선택하므로, string literal union 사용
 */

/* ─── FC-1: 실행 토폴로지 ─── */

/**
 * ExecutionTarget — 작업이 실행될 환경을 나타낸다.
 * 오케스트레이터가 worker 라우팅 시 참조한다.
 *
 * - `local`      : 동일 프로세스 내 인메모리 실행 (기본값)
 * - `subprocess` : 로컬 머신에서 별도 프로세스로 실행
 * - `container`  : Podman/Docker 컨테이너 (로컬 또는 원격 데몬)
 * - `cloud_fn`   : 서버리스 함수 (AWS Lambda, GCP Cloud Run 등)
 * - `remote_rpc` : gRPC/HTTP 원격 워커 엔드포인트
 */
export type ExecutionTarget =
  | "local"
  | "subprocess"
  | "container"
  | "cloud_fn"
  | "remote_rpc";

/**
 * JobDispatchMode — 작업 디스패치 전략.
 * ExecutionTarget과 독립적으로 직렬/병렬/큐 방식을 결정한다.
 *
 * - `inline`      : 호출자 컨텍스트에서 동기적으로 실행
 * - `background`  : 별도 태스크로 비동기 실행 (fire-and-forget)
 * - `queued`      : 외부 큐(Redis, SQS 등)를 통해 비동기 실행
 * - `fan_out`     : 동일 작업을 여러 타겟에 병렬 브로드캐스트
 */
export type JobDispatchMode = "inline" | "background" | "queued" | "fan_out";

/**
 * ExecutionTopology — 실행 타겟 + 디스패치 모드 조합.
 * 워크플로우 노드별로 설정 가능하다.
 */
export interface ExecutionTopology {
  /** 실행 환경. 기본값: `local`. */
  target: ExecutionTarget;
  /** 디스패치 전략. 기본값: `inline`. */
  dispatch_mode: JobDispatchMode;
}

/** 기본 실행 토폴로지 (로컬 인라인). */
export const DEFAULT_EXECUTION_TOPOLOGY: ExecutionTopology = {
  target: "local",
  dispatch_mode: "inline",
} as const;

/* ─── FC-5: 배포 메타데이터 ─── */

/**
 * DeploymentKind — 인프라 환경 분류.
 *
 * - `self_hosted` : 사용자 소유 인프라 (기본값)
 * - `managed`     : 공급업체 관리형 (SaaS, Heroku 등)
 * - `serverless`  : 완전 서버리스 (Lambda, Cloud Run 등)
 * - `edge`        : CDN 엣지 런타임 (Cloudflare Workers 등)
 */
export type DeploymentKind = "self_hosted" | "managed" | "serverless" | "edge";

/**
 * TrustZone — 네트워크 신뢰 경계.
 *
 * - `private`  : 사설망 내부 (VPC, 온프레미스 등)
 * - `internal` : 내부 클라우드 망 (같은 VPC 내)
 * - `public`   : 공개 인터넷에 노출
 */
export type TrustZone = "private" | "internal" | "public";

/**
 * DeploymentMeta — 배포 환경 메타데이터.
 * 어댑터 선택, 네트워크 정책, 비용 최적화에 활용된다.
 */
export interface DeploymentMeta {
  /**
   * 인프라 환경 종류.
   * 기본값: `self_hosted`.
   */
  deployment_kind: DeploymentKind;

  /**
   * 네트워크 신뢰 경계.
   * 기본값: `private`.
   */
  trust_zone: TrustZone;

  /**
   * 외부 네트워크(인터넷) 송신이 허용되는지 여부.
   * false일 경우 외부 API 호출 어댑터 사용 불가.
   * 기본값: `true`.
   */
  egress_required: boolean;

  /**
   * 데이터 상주 리전 (예: "ap-northeast-2", "us-east-1").
   * 미설정 시 리전 제약 없음.
   */
  region?: string;
}

/** 기본 배포 메타데이터 (로컬 셀프 호스팅). */
export const DEFAULT_DEPLOYMENT_META: DeploymentMeta = {
  deployment_kind: "self_hosted",
  trust_zone: "private",
  egress_required: true,
} as const;

/* ─── 헬퍼 ─── */

/**
 * 배포 메타데이터에서 cloud adapter 사용 가능 여부를 판단한다.
 * `egress_required: false`이면 cloud adapter는 사용 불가.
 */
export function can_use_cloud_adapter(meta: DeploymentMeta): boolean {
  return meta.egress_required && meta.trust_zone !== "private";
}

/**
 * 서버리스 환경인지 판단한다.
 * 서버리스 환경은 영구 프로세스 상태를 유지할 수 없으므로
 * 인메모리 어댑터 대신 외부 저장소 어댑터가 필요하다.
 */
export function is_stateless_environment(meta: DeploymentMeta): boolean {
  return meta.deployment_kind === "serverless" || meta.deployment_kind === "edge";
}
