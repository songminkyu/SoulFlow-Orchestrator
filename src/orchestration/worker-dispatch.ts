/**
 * LF-2: WorkerDispatch — inline / local-queue / remote-queue 경계 고정.
 *
 * worker 레이어 소속. agent와 worker는 서로 다른 개념:
 *   - agent: LLM을 사용해 반응형으로 동작하는 실행 단위
 *   - worker: 배경에서 비동기로 처리되는 작업 단위 (cron, kanban, generation task)
 *
 * dispatch 모드:
 *   - inline: 현재 요청 처리 컨텍스트에서 즉시 실행 (낮은 지연, 단순 작업)
 *   - local_queue: 동일 프로세스 내 큐에서 비동기 실행 (메모리 버스)
 *   - remote_queue: 외부 큐(Redis)로 오프로드 (내구성, 스케일 아웃)
 */

/** worker 작업 dispatch 모드. */
export type WorkerDispatchMode = "inline" | "local_queue" | "remote_queue";

/** worker 작업 유형 — 도메인별 분류. */
export type WorkerJobKind =
  | "cron"               // 예약된 크론 잡
  | "kanban_automation"  // 칸반 자동화 트리거
  | "generation_task"    // 사용자 생성 Task
  | "system_task";       // 시스템 내부 Task (정리, 인덱싱 등)

/** suitability 평가 입력. */
export type WorkerSuitabilityInput = {
  /** 작업 종류. */
  kind: WorkerJobKind;
  /** 예상 소요 시간 (ms). 미제공 시 미지 (unknown). */
  estimated_duration_ms?: number;
  /** 이 작업이 Redis 버스를 사용 가능한 환경인지. */
  redis_available: boolean;
  /** 실패 시 재시도가 필요한지 (내구성 요구). */
  requires_durability: boolean;
  /** 현재 로컬 큐 부하 (0.0 ~ 1.0). */
  local_queue_load: number;
};

/** dispatch 결정 결과. */
export type WorkerDispatchDecision = {
  mode: WorkerDispatchMode;
  /** 이 모드를 선택한 이유. 디버깅/로깅용. */
  reason: string;
};

/**
 * suitability 규칙에 따라 최적 dispatch 모드를 결정.
 *
 * 우선순위:
 * 1. 내구성 요구 + Redis 사용 가능 → remote_queue
 * 2. 로컬 큐 부하 < 0.8 → local_queue
 * 3. 그 외 (가벼운 작업, 즉시 처리) → inline
 */
export function resolve_dispatch_mode(input: WorkerSuitabilityInput): WorkerDispatchDecision {
  // 내구성 요구: 실패 시 재시도 + Redis 사용 가능 → remote_queue
  if (input.requires_durability && input.redis_available) {
    return {
      mode: "remote_queue",
      reason: "requires_durability + redis_available → remote_queue for persistence",
    };
  }

  // 로컬 큐 부하가 임계치 미만이고 Redis 없어도 됨 → local_queue
  if (input.local_queue_load < 0.8 && !input.requires_durability) {
    return {
      mode: "local_queue",
      reason: `local_queue_load=${input.local_queue_load.toFixed(2)} < 0.8, durability not required`,
    };
  }

  // 내구성 요구하지만 Redis 없음 → inline 폴백 (최선 노력)
  if (input.requires_durability && !input.redis_available) {
    return {
      mode: "inline",
      reason: "requires_durability but redis unavailable — inline fallback (best-effort)",
    };
  }

  // 로컬 큐 부하 포화 → inline (즉시 처리, 큐 bypassing)
  return {
    mode: "inline",
    reason: `local_queue_load=${input.local_queue_load.toFixed(2)} >= 0.8 — inline to bypass saturated queue`,
  };
}

/** worker 작업 디스크립터 — dispatch에 필요한 최소 정보. */
export type WorkerJobDescriptor = {
  job_id: string;
  kind: WorkerJobKind;
  /** 작업 실행 함수 — dispatch 시 호출됨. */
  run: () => Promise<void>;
};

/** WorkerDispatch 상태 요약 — 모니터링용. */
export type WorkerDispatchStatus = {
  pending_local: number;
  mode_distribution: Record<WorkerDispatchMode, number>;
};

/**
 * WorkerDispatch — worker 작업의 dispatch 경계를 관리.
 *
 * 역할:
 *   - suitability 규칙 평가 (resolve_dispatch_mode)
 *   - 로컬 큐 관리 (inline / local_queue)
 *   - remote_queue dispatch 위임 (인터페이스 주입)
 */
export class WorkerDispatch {
  private readonly local_queue: WorkerJobDescriptor[] = [];
  private readonly mode_counts: Record<WorkerDispatchMode, number> = {
    inline: 0,
    local_queue: 0,
    remote_queue: 0,
  };
  private readonly remote_dispatch: ((job: WorkerJobDescriptor) => Promise<void>) | null;

  constructor(opts: {
    /** remote_queue 위임 함수. Redis/외부 큐에 enqueue하는 구현체를 주입. */
    remote_dispatch?: (job: WorkerJobDescriptor) => Promise<void>;
  } = {}) {
    this.remote_dispatch = opts.remote_dispatch ?? null;
  }

  /**
   * 작업을 dispatch 모드 결정 후 실행 또는 큐잉.
   *
   * @param job 실행할 worker 작업
   * @param suitability dispatch 모드 결정 입력
   * @returns 결정된 dispatch 모드
   */
  async dispatch(
    job: WorkerJobDescriptor,
    suitability: WorkerSuitabilityInput,
  ): Promise<WorkerDispatchDecision> {
    const decision = resolve_dispatch_mode(suitability);
    this.mode_counts[decision.mode]++;

    switch (decision.mode) {
      case "inline":
        // 즉시 동기 실행 (현재 컨텍스트에서)
        await job.run();
        break;

      case "local_queue":
        // 로컬 큐에 추가 — drain 루프가 처리
        this.local_queue.push(job);
        break;

      case "remote_queue":
        if (this.remote_dispatch) {
          await this.remote_dispatch(job);
        } else {
          // remote_dispatch 미주입 시 local_queue 폴백
          this.local_queue.push(job);
        }
        break;
    }

    return decision;
  }

  /**
   * 로컬 큐를 drain — 큐에 쌓인 작업을 순차 실행.
   * 서비스 루프 또는 shutdown 시 호출.
   */
  async drain_local_queue(): Promise<void> {
    while (this.local_queue.length > 0) {
      const job = this.local_queue.shift();
      if (job) await job.run();
    }
  }

  /** 현재 dispatch 상태 스냅샷. */
  get_status(): WorkerDispatchStatus {
    return {
      pending_local: this.local_queue.length,
      mode_distribution: { ...this.mode_counts },
    };
  }
}
