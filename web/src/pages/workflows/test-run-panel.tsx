/**
 * TestRunPanel (B4.2): 워크플로우 테스트 실행 패널.
 * Input 탭 (스키마 기반 입력 폼) + Result 탭 (실행 결과 뷰어).
 */
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useT } from "../../i18n";

interface TestRunPanelProps {
  workflow_slug: string;
  input_schema?: Array<{ name: string; type: string; description?: string; required?: boolean }>;
  className?: string;
}

type TabId = "input" | "result";

export function TestRunPanel({ workflow_slug, input_schema = [], className }: TestRunPanelProps) {
  const t = useT();
  const [tab, setTab] = useState<TabId>("input");
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const run_mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{ run_id: string; result?: unknown }>(`/api/workflow/runs`, {
        template: workflow_slug,
        input: payload,
        test_mode: true,
      }),
    onSuccess: () => setTab("result"),
  });

  const parsed_input = useMemo(() => {
    const result: Record<string, unknown> = {};
    for (const field of input_schema) {
      const raw = inputs[field.name] ?? "";
      if (!raw && !field.required) continue;
      if (field.type === "number") result[field.name] = Number(raw) || 0;
      else if (field.type === "boolean") result[field.name] = raw === "true";
      else if (field.type === "object" || field.type === "array") {
        try { result[field.name] = JSON.parse(raw); }
        catch { result[field.name] = raw; }
      }
      else result[field.name] = raw;
    }
    return result;
  }, [inputs, input_schema]);

  const handle_run = () => {
    run_mutation.mutate(parsed_input);
  };

  return (
    <div className={`test-run-panel${className ? ` ${className}` : ""}`}>
      {/* Tab 헤더 */}
      <div className="test-run-panel__tabs">
        <button
          type="button"
          className={`test-run-panel__tab${tab === "input" ? " test-run-panel__tab--active" : ""}`}
          onClick={() => setTab("input")}
        >
          {t("workflows.test_input")}
        </button>
        <button
          type="button"
          className={`test-run-panel__tab${tab === "result" ? " test-run-panel__tab--active" : ""}`}
          onClick={() => setTab("result")}
        >
          {t("workflows.test_result")}
        </button>
      </div>

      {/* Input 탭 */}
      {tab === "input" && (
        <div className="test-run-panel__body">
          {input_schema.length === 0 && (
            <div className="test-run-panel__empty">{t("workflows.test_no_schema")}</div>
          )}
          {input_schema.map((field) => (
            <div key={field.name} className="test-run-panel__field">
              <label className="test-run-panel__field-label">
                {field.name}
                {field.required && <span className="label__required">*</span>}
                <span className="test-run-panel__field-type" data-ft={field.type}>{field.type}</span>
              </label>
              {field.description && (
                <span className="test-run-panel__field-desc">{field.description}</span>
              )}
              {field.type === "boolean" ? (
                <select
                  className="input input--sm"
                  value={inputs[field.name] ?? "false"}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (field.type === "object" || field.type === "array") ? (
                <textarea
                  className="input code-textarea"
                  rows={3}
                  value={inputs[field.name] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                  placeholder={field.type === "object" ? '{"key": "value"}' : '["item1", "item2"]'}
                  spellCheck={false}
                />
              ) : (
                <input
                  className="input input--sm"
                  type={field.type === "number" ? "number" : "text"}
                  value={inputs[field.name] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                  placeholder={field.description || field.name}
                />
              )}
            </div>
          ))}
          <div className="test-run-panel__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={handle_run}
              disabled={run_mutation.isPending}
            >
              {run_mutation.isPending ? t("common.loading") : t("workflows.test_run")}
            </button>
          </div>
        </div>
      )}

      {/* Result 탭 */}
      {tab === "result" && (
        <div className="test-run-panel__body">
          {run_mutation.isPending && (
            <div className="test-run-panel__loading">{t("common.loading")}</div>
          )}
          {run_mutation.isError && (
            <div className="test-run-panel__error">
              {(run_mutation.error as Error)?.message || t("workflows.test_error")}
            </div>
          )}
          {run_mutation.isSuccess && (
            <div className="test-run-panel__result">
              <div className="test-run-panel__result-header">
                <span className="test-run-panel__result-id">
                  {run_mutation.data?.run_id}
                </span>
              </div>
              <pre className="test-run-panel__result-json">
                {JSON.stringify(run_mutation.data?.result ?? run_mutation.data, null, 2)}
              </pre>
            </div>
          )}
          {!run_mutation.isPending && !run_mutation.isError && !run_mutation.isSuccess && (
            <div className="test-run-panel__empty">{t("workflows.test_no_result")}</div>
          )}
        </div>
      )}
    </div>
  );
}
