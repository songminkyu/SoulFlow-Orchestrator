import { useState } from "react";
import { FormModal } from "../components/modal";
import { useT } from "../i18n";
import { SCOPE_TYPES } from "./kanban-types";

export function CreateBoardModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void;
  onCreate: (name: string, scope_type: string, scope_id: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [scopeType, setScopeType] = useState<string>("workflow");
  const [scopeId, setScopeId] = useState("");

  const reset = () => { setName(""); setScopeType("workflow"); setScopeId(""); };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !scopeId.trim()) return;
    onCreate(name.trim(), scopeType, scopeId.trim());
    reset();
  };

  return (
    <FormModal open={open} title={t("kanban.new_board")} onClose={() => { onClose(); reset(); }}
      onSubmit={handle_submit} submitLabel={t("kanban.create_board")} submitDisabled={!name.trim() || !scopeId.trim()}>
      <label className="form-label">{t("kanban.board_name")}</label>
      <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus
        placeholder="e.g. Sprint 1, My Project" />

      <label className="form-label kanban-form__label--mt">{t("kanban.scope_type")}</label>
      <select className="form-input" value={scopeType} onChange={e => setScopeType(e.target.value)}>
        {SCOPE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <label className="form-label kanban-form__label--mt">{t("kanban.scope_id")}</label>
      <input className="form-input" value={scopeId} onChange={e => setScopeId(e.target.value)}
        placeholder="e.g. my-workflow, #general"
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && scopeId.trim()) handle_submit(e as unknown as React.FormEvent); }} />
    </FormModal>
  );
}
