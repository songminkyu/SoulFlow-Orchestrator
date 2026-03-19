import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";
import { BuilderField, BuilderRowPair } from "../builder-field";

/** FE-5: retrieval 모드 (lexical/semantic/hybrid). */
type RetrievalMode = "lexical" | "semantic" | "hybrid";

const RETRIEVAL_MODE_VARIANT: Record<RetrievalMode, "info" | "ok" | "warn"> = {
  lexical: "info",
  semantic: "ok",
  hybrid: "warn",
};

function RetrieverEditPanel({ node, update, t }: EditPanelProps) {
  const source = String(node.source || "http");
  const retrieval_mode = String(node.retrieval_mode || "semantic") as RetrievalMode;
  const retrieval_status = String(node.retrieval_status || "");

  return (
    <>
      {/* FE-5: retrieval 상태 배지 + 모드 표시 */}
      {retrieval_status && (
        <div className="builder-field__inline-badges" data-testid="retrieval-status-badge">
          <span className={`badge badge--${retrieval_status === "ready" ? "ok" : retrieval_status === "indexing" ? "warn" : "err"}`}>
            {retrieval_status}
          </span>
        </div>
      )}
      <BuilderRowPair>
        <BuilderField label={t("workflows.retriever_source")}>
          <select autoFocus className="input input--sm" value={source} onChange={(e) => update({ source: e.target.value })}>
            <option value="http">{t("workflows.opt_http_api")}</option>
            <option value="file">{t("workflows.opt_file")}</option>
            <option value="memory">{t("workflows.opt_memory")}</option>
          </select>
        </BuilderField>
        <BuilderField label={t("workflows.retriever_top_k")} hint={t("workflows.retriever_top_k_hint")}>
          <input className="input input--sm" type="number" min={1} max={100} value={String(node.top_k ?? 5)} onChange={(e) => update({ top_k: Number(e.target.value) || 5 })} />
        </BuilderField>
      </BuilderRowPair>
      {/* FE-5: lexical/semantic 모드 선택 */}
      <BuilderRowPair>
        <BuilderField label={t("workflows.retrieval_mode")}>
          <select
            className="input input--sm"
            value={retrieval_mode}
            onChange={(e) => update({ retrieval_mode: e.target.value })}
            data-testid="retrieval-mode-select"
          >
            <option value="lexical">{t("workflows.retrieval_mode_lexical")}</option>
            <option value="semantic">{t("workflows.retrieval_mode_semantic")}</option>
            <option value="hybrid">{t("workflows.retrieval_mode_hybrid")}</option>
          </select>
        </BuilderField>
        <div className="builder-field__mode-indicator">
          <span className={`badge badge--${RETRIEVAL_MODE_VARIANT[retrieval_mode]}`} data-testid="retrieval-mode-badge">
            {retrieval_mode}
          </span>
        </div>
      </BuilderRowPair>
      <BuilderField label={t("workflows.retriever_query")}>
        <input className="input input--sm" value={String(node.query || "")} onChange={(e) => update({ query: e.target.value })} placeholder="{{memory.user_question}}" />
      </BuilderField>
      {source === "http" && (
        <>
          <BuilderRowPair>
            <BuilderField label={t("workflows.http_method")}>
              <select className="input input--sm" value={String(node.method || "GET")} onChange={(e) => update({ method: e.target.value })}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </BuilderField>
            <BuilderField label={t("workflows.http_url")}>
              <input className="input input--sm" value={String(node.url || "")} onChange={(e) => update({ url: e.target.value })} placeholder="https://api.example.com/search" />
            </BuilderField>
          </BuilderRowPair>
        </>
      )}
      {source === "file" && (
        <BuilderField label={t("workflows.file_path")}>
          <input className="input input--sm" value={String(node.file_path || "")} onChange={(e) => update({ file_path: e.target.value })} placeholder="data/knowledge.json" />
        </BuilderField>
      )}
    </>
  );
}

export const retriever_descriptor: FrontendNodeDescriptor = {
  node_type: "retriever",
  icon: "⤓",
  color: "#00bcd4",
  shape: "rect",
  toolbar_label: "node.retriever.label",
  category: "ai",
  output_schema: [
    { name: "results", type: "array",  description: "node.retriever.output.results" },
    { name: "count",   type: "number", description: "node.retriever.output.count" },
    { name: "query",   type: "string", description: "node.retriever.output.query" },
  ],
  input_schema: [
    { name: "query",  type: "string", description: "node.retriever.input.query" },
    { name: "source", type: "string", description: "node.retriever.input.source" },
  ],
  create_default: () => ({ source: "http", query: "", url: "", top_k: 5, method: "GET", file_path: "", retrieval_mode: "semantic" }),
  EditPanel: RetrieverEditPanel,
};
