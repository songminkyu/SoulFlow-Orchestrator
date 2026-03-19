import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_EXECUTION_TOPOLOGY,
  DEFAULT_DEPLOYMENT_META,
  can_use_cloud_adapter,
  is_stateless_environment,
  type ExecutionTarget,
  type JobDispatchMode,
  type DeploymentMeta,
  type ExecutionTopology,
} from '../../src/config/portability.js';
import {
  LocalRuntimeLocator,
  create_local_runtime_locator,
  type RuntimeLocatorLike,
  type RuntimeDescriptor,
} from '../../src/workspace/runtime-locator.js';
import {
  LocalArtifactStore,
  create_local_artifact_store,
  type ArtifactStoreLike,
  type CloudArtifactAdapterHint,
  type ArtifactMeta,
} from '../../src/services/artifact-store.js';
import {
  create_local_coordination_store,
  type CoordinationStoreLike,
} from '../../src/bus/coordination-store.js';
import type {
  DurableEventStoreLike,
  RealtimeEventRelayLike,
  DurableEvent,
  RealtimeEvent,
  CloudCoordinationAdapterHint,
} from '../../src/bus/ports.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/* FC-1 */
describe('FC-1 ExecutionTarget', () => {
  it('valid ExecutionTarget values', () => {
    const valid_targets: ExecutionTarget[] = ['local','subprocess','container','cloud_fn','remote_rpc'];
    for (const t of valid_targets) expect(typeof t).toBe('string');
    expect(valid_targets).toHaveLength(5);
  });
  it('valid JobDispatchMode values', () => {
    const valid_modes: JobDispatchMode[] = ['inline','background','queued','fan_out'];
    for (const m of valid_modes) expect(typeof m).toBe('string');
    expect(valid_modes).toHaveLength(4);
  });
  it('DEFAULT_EXECUTION_TOPOLOGY is local+inline', () => {
    expect(DEFAULT_EXECUTION_TOPOLOGY.target).toBe('local');
    expect(DEFAULT_EXECUTION_TOPOLOGY.dispatch_mode).toBe('inline');
  });
  it('ExecutionTopology combines target and dispatch_mode', () => {
    const topology: ExecutionTopology = { target: 'cloud_fn', dispatch_mode: 'queued' };
    expect(topology.target).toBe('cloud_fn');
    expect(topology.dispatch_mode).toBe('queued');
  });
});

/* FC-5 */
describe('FC-5 DeploymentMeta', () => {
  it('DEFAULT_DEPLOYMENT_META defaults', () => {
    expect(DEFAULT_DEPLOYMENT_META.deployment_kind).toBe('self_hosted');
    expect(DEFAULT_DEPLOYMENT_META.trust_zone).toBe('private');
    expect(DEFAULT_DEPLOYMENT_META.egress_required).toBe(true);
  });
  describe('can_use_cloud_adapter', () => {
    it('false for private trust_zone', () => {
      expect(can_use_cloud_adapter({ deployment_kind: 'self_hosted', trust_zone: 'private', egress_required: true })).toBe(false);
    });
    it('false when egress_required is false', () => {
      expect(can_use_cloud_adapter({ deployment_kind: 'managed', trust_zone: 'public', egress_required: false })).toBe(false);
    });
    it('true for public+egress true', () => {
      expect(can_use_cloud_adapter({ deployment_kind: 'managed', trust_zone: 'public', egress_required: true })).toBe(true);
    });
    it('true for internal+egress true', () => {
      expect(can_use_cloud_adapter({ deployment_kind: 'serverless', trust_zone: 'internal', egress_required: true })).toBe(true);
    });
  });
  describe('is_stateless_environment', () => {
    it('true for serverless', () => {
      expect(is_stateless_environment({ deployment_kind: 'serverless', trust_zone: 'public', egress_required: true })).toBe(true);
    });
    it('true for edge', () => {
      expect(is_stateless_environment({ deployment_kind: 'edge', trust_zone: 'public', egress_required: true })).toBe(true);
    });
    it('false for self_hosted', () => {
      expect(is_stateless_environment(DEFAULT_DEPLOYMENT_META)).toBe(false);
    });
    it('false for managed', () => {
      expect(is_stateless_environment({ deployment_kind: 'managed', trust_zone: 'internal', egress_required: true })).toBe(false);
    });
  });
});

/* FC-4 */
describe('FC-4 RuntimeLocatorLike + LocalRuntimeLocator', () => {
  let locator: RuntimeLocatorLike;
  beforeEach(() => { locator = new LocalRuntimeLocator(); });

  it('create_local_runtime_locator returns RuntimeLocatorLike', () => {
    const l = create_local_runtime_locator();
    expect(typeof l.resolve).toBe('function');
    expect(typeof l.list_available).toBe('function');
    expect(typeof l.health_check).toBe('function');
  });

  describe('resolve', () => {
    it('local target returns descriptor', async () => {
      const desc = await locator.resolve('local');
      expect(desc).not.toBeNull();
      expect(desc!.id).toBe('local');
      expect(desc!.target).toBe('local');
      expect(desc!.available).toBe(true);
    });
    it('non-local targets return null', async () => {
      const targets: ExecutionTarget[] = ['subprocess','container','cloud_fn','remote_rpc'];
      for (const target of targets) {
        const desc = await locator.resolve(target);
        expect(desc).toBeNull();
      }
    });
    it('hint does not break local resolve', async () => {
      const desc = await locator.resolve('local', 'preferred');
      expect(desc).not.toBeNull();
    });
  });

  describe('list_available', () => {
    it('no filter returns [local]', async () => {
      const list = await locator.list_available();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('local');
    });
    it('local filter returns one item', async () => {
      expect(await locator.list_available('local')).toHaveLength(1);
    });
    it('cloud_fn filter returns empty', async () => {
      expect(await locator.list_available('cloud_fn')).toHaveLength(0);
    });
  });

  describe('health_check', () => {
    it('local id returns true', async () => {
      expect(await locator.health_check('local')).toBe(true);
    });
    it('unknown id returns false', async () => {
      expect(await locator.health_check('unknown')).toBe(false);
    });
  });

  it('RuntimeDescriptor has required fields', async () => {
    const desc = await locator.resolve('local');
    const required_fields: Array<keyof RuntimeDescriptor> = ['id','target','available'];
    for (const field of required_fields) expect(desc).toHaveProperty(field);
  });
});

/* FC-2 */
describe('FC-2 CloudArtifactAdapterHint', () => {
  it('interface requires 3 cloud methods', () => {
    const mock_cloud: ArtifactStoreLike & CloudArtifactAdapterHint = {
      put: async () => ({ key: 'k', size: 0, created_at: '' }),
      get: async () => null,
      stat: async () => null,
      list: async () => [],
      delete: async () => undefined,
      get_signed_url: async () => null,
      copy: async (): Promise<ArtifactMeta | null> => null,
      get_bucket: () => 'test-bucket',
    };
    expect(typeof mock_cloud.get_signed_url).toBe('function');
    expect(typeof mock_cloud.copy).toBe('function');
    expect(mock_cloud.get_bucket()).toBe('test-bucket');
  });

  it('local store does not implement cloud hint', async () => {
    let tmp_dir: string | null = null;
    try {
      tmp_dir = await mkdtemp(join(tmpdir(), 'fc2-'));
      const store = create_local_artifact_store(tmp_dir);
      expect('get_signed_url' in store).toBe(false);
      expect('copy' in store).toBe(false);
      expect('get_bucket' in store).toBe(false);
    } finally {
      if (tmp_dir) await rm(tmp_dir, { recursive: true, force: true });
    }
  });
});

/* FC-3 DurableEventStore */
describe('FC-3 DurableEventStoreLike', () => {
  it('mock satisfies contract', async () => {
    const events: DurableEvent[] = [];
    const store: DurableEventStoreLike = {
      async append(event: DurableEvent) { events.push(event); return event.id; },
      async consume_batch(cursor: string | null, limit: number) {
        const si = cursor ? events.findIndex((e) => e.id === cursor) + 1 : 0;
        const batch = events.slice(si, si + limit);
        return [batch, batch.length > 0 ? batch[batch.length - 1].id : null];
      },
      async ack() {},
      async query_by_kind(kind: string, limit: number) {
        return events.filter((e) => e.kind === kind).slice(0, limit);
      },
      async sweep() { return 0; },
    };
    const ev: DurableEvent = {
      id: 'ev-001',
      kind: 'run.started',
      occurred_at: new Date().toISOString(),
      payload: {},
      team_id: 'T',
    };
    expect(await store.append(ev)).toBe('ev-001');
    const [batch, next] = await store.consume_batch(null, 10);
    expect(batch).toHaveLength(1);
    expect(next).toBe('ev-001');
    const [b2, n2] = await store.consume_batch('ev-001', 10);
    expect(b2).toHaveLength(0);
    expect(n2).toBeNull();
    await expect(store.ack('ev-001', 'c1')).resolves.toBeUndefined();
    expect(await store.query_by_kind('run.started', 5)).toHaveLength(1);
    expect(typeof await store.sweep(0)).toBe('number');
  });
});

/* FC-3 RealtimeEventRelay */
describe('FC-3 RealtimeEventRelayLike', () => {
  it('mock satisfies contract', async () => {
    const received: RealtimeEvent[] = [];
    const relay: RealtimeEventRelayLike = {
      async publish(ev: RealtimeEvent) { received.push(ev); },
      subscribe() { return () => {}; },
      async close() {},
    };
    const unsub = relay.subscribe('T', null, () => {});
    const ev: RealtimeEvent = {
      kind: 'progress',
      occurred_at: new Date().toISOString(),
      payload: {},
      channel: 'c1',
      team_id: 'T',
    };
    await relay.publish(ev);
    expect(received).toHaveLength(1);
    expect(received[0].kind).toBe('progress');
    expect(typeof unsub).toBe('function');
    await relay.close();
  });
});

/* FC-3 CloudCoordinationAdapterHint */
describe('FC-3 CloudCoordinationAdapterHint', () => {
  it('heartbeat + list_global contract', async () => {
    const base = create_local_coordination_store();
    // cloud adapter: 기존 port를 위임하고 추가 메서드를 구현
    const cloud: CoordinationStoreLike & CloudCoordinationAdapterHint = {
      acquire: (k, o, t) => base.acquire(k, o, t),
      release: (k, o) => base.release(k, o),
      get: (k) => base.get(k),
      list: (p) => base.list(p),
      sweep: () => base.sweep(),
      async heartbeat(key: string, owner: string, extend_ms: number) {
        const e = await base.get(key);
        if (!e || e.owner !== owner) return false;
        return (await base.acquire(key, owner, extend_ms)) !== null;
      },
      async list_global() { return base.list(); },
    };
    const entry = await cloud.acquire('r1', 'A', 5000);
    expect(entry).not.toBeNull();
    expect(await cloud.heartbeat('r1', 'A', 10000)).toBe(true);
    expect(await cloud.heartbeat('r1', 'B', 10000)).toBe(false);
    const gl = await cloud.list_global();
    expect(gl.length).toBeGreaterThanOrEqual(1);
    expect(gl.some((e) => e.owner === 'A')).toBe(true);
  });
});

/* FC-6 Integration */
describe('FC-6 portability integration', () => {
  it('local adapters share same contract interfaces', () => {
    const as: ArtifactStoreLike = create_local_artifact_store(tmpdir());
    expect(typeof as.put).toBe('function');
    expect(typeof as.get).toBe('function');
    const cs: CoordinationStoreLike = create_local_coordination_store();
    expect(typeof cs.acquire).toBe('function');
    expect(typeof cs.release).toBe('function');
    const rl: RuntimeLocatorLike = create_local_runtime_locator();
    expect(typeof rl.resolve).toBe('function');
  });

  it('LocalArtifactStore put/get/delete lifecycle', async () => {
    let tmp_dir: string | null = null;
    try {
      tmp_dir = await mkdtemp(join(tmpdir(), 'fc6-'));
      const store = new LocalArtifactStore(tmp_dir);
      const meta = await store.put('run-1/output.txt', 'hello portability');
      expect(meta.key).toBe('run-1/output.txt');
      expect(meta.size).toBeGreaterThan(0);
      const buf = await store.get('run-1/output.txt');
      expect(buf!.toString('utf8')).toBe('hello portability');
      await store.delete('run-1/output.txt');
      expect(await store.get('run-1/output.txt')).toBeNull();
    } finally {
      if (tmp_dir) await rm(tmp_dir, { recursive: true, force: true });
    }
  });

  it('ExecutionTopology + DeploymentMeta helpers are consistent', () => {
    const cloud_meta: DeploymentMeta = {
      deployment_kind: 'serverless',
      trust_zone: 'public',
      egress_required: true,
    };
    expect(is_stateless_environment(cloud_meta)).toBe(true);
    expect(can_use_cloud_adapter(cloud_meta)).toBe(true);
    expect(is_stateless_environment(DEFAULT_DEPLOYMENT_META)).toBe(false);
    expect(can_use_cloud_adapter(DEFAULT_DEPLOYMENT_META)).toBe(false);
  });
});
