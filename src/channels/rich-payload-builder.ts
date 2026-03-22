/**
 * IC-8a: RichPayload 빌더 — task/workflow 데이터를 채널 중립 RichPayload로 변환.
 * 채널별 렌더러(discord/slack/telegram)에서 이 타입을 소비한다.
 */

import type { RichEmbed, RichPayload } from "../bus/types.js";

export type { RichEmbed, RichPayload };

/** 상태 컬러 매핑 — 채널별 변환은 각 채널에서 처리. */
export function status_to_color(status: string): RichEmbed["color"] {
  const s = String(status || "").toLowerCase();
  if (s === "ok" || s === "success" || s === "done" || s === "approved") return "green";
  if (s === "warn" || s === "warning" || s === "pending" || s === "review") return "yellow";
  if (s === "error" || s === "fail" || s === "failed" || s === "rejected") return "red";
  return "blue";
}

export type TaskRichData = {
  task_id: string;
  title: string;
  status: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: string;
  image_url?: string;
  thumbnail_url?: string;
  attachments?: Array<{ url: string; name?: string; mime?: string }>;
};

/**
 * 태스크/HITL 승인 데이터를 RichPayload로 변환.
 * 모든 필드는 선택적이며, 최소 task_id + title + status만 있어도 동작.
 */
export function build_rich_payload(data: TaskRichData): RichPayload {
  const color = status_to_color(data.status);

  const base_fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Task ID", value: String(data.task_id || "—"), inline: true },
    { name: "Status", value: String(data.status || "—"), inline: true },
  ];

  const extra_fields = Array.isArray(data.fields)
    ? data.fields.filter((f) => f && typeof f.name === "string" && typeof f.value === "string")
    : [];

  const embed: RichEmbed = {
    title: String(data.title || "").slice(0, 256) || undefined,
    description: data.description ? String(data.description).slice(0, 4096) : undefined,
    color,
    fields: [...base_fields, ...extra_fields],
    image_url: data.image_url || undefined,
    thumbnail_url: data.thumbnail_url || undefined,
    footer: data.footer || undefined,
  };

  return {
    embeds: [embed],
    attachments: data.attachments,
  };
}

/**
 * 워크플로우 결과를 RichPayload로 변환.
 * workflow_id, node_id, result 필드 포함.
 */
export type WorkflowRichData = {
  workflow_id: string;
  node_id?: string;
  title?: string;
  status: string;
  summary?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  footer?: string;
  attachments?: Array<{ url: string; name?: string; mime?: string }>;
};

export function build_workflow_rich_payload(data: WorkflowRichData): RichPayload {
  const color = status_to_color(data.status);

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Workflow ID", value: String(data.workflow_id || "—"), inline: true },
    { name: "Status", value: String(data.status || "—"), inline: true },
  ];

  if (data.node_id) {
    fields.push({ name: "Node", value: String(data.node_id), inline: true });
  }

  if (data.inputs && typeof data.inputs === "object") {
    const entries = Object.entries(data.inputs)
      .slice(0, 5) // limit fields
      .map(([k, v]) => `**${k}**: ${String(v ?? "—").slice(0, 100)}`);
    if (entries.length > 0) {
      fields.push({ name: "Inputs", value: entries.join("\n"), inline: false });
    }
  }

  if (data.outputs && typeof data.outputs === "object") {
    const entries = Object.entries(data.outputs)
      .slice(0, 5)
      .map(([k, v]) => `**${k}**: ${String(v ?? "—").slice(0, 100)}`);
    if (entries.length > 0) {
      fields.push({ name: "Outputs", value: entries.join("\n"), inline: false });
    }
  }

  const embed: RichEmbed = {
    title: (data.title || `Workflow: ${data.workflow_id}`).slice(0, 256),
    description: data.summary ? String(data.summary).slice(0, 4096) : undefined,
    color,
    fields,
    footer: data.footer || undefined,
  };

  return {
    embeds: [embed],
    attachments: data.attachments,
  };
}
