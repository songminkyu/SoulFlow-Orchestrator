import { useT } from "../../i18n";
import type { AgentDefinition } from "../../../../src/agent/agent-definition.types";

interface AgentCardProps {
  definition: AgentDefinition;
  onFork: (id: string) => void;
  onEdit: (definition: AgentDefinition) => void;
  onDelete: (id: string) => void;
  onUse: (definition: AgentDefinition) => void;
}

export function AgentCard({ definition, onFork, onEdit, onDelete, onUse }: AgentCardProps) {
  const t = useT();
  const { id, name, description, icon, role_skill, soul, is_builtin, use_count, shared_protocols } = definition;

  return (
    <div className={`stat-card${is_builtin ? " agent-card--builtin" : ""}`} data-testid={`agent-card-${id}`}>
      <div className="agent-card__top">
        <div className="agent-card__icon" aria-hidden="true">{icon || "🤖"}</div>
        <div className="agent-card__header">
          <span className="stat-card__value stat-card__value--md">{name}</span>
          <div className="agent-card__badges">
            {is_builtin && (
              <span className="badge badge--info" title={t("agents.builtin_tooltip")}>
                {t("agents.builtin")}
              </span>
            )}
            {role_skill && (
              <span className="badge badge--off" title={t("agents.role_skill")}>{role_skill.replace("role:", "")}</span>
            )}
            {shared_protocols.slice(0, 2).map((p) => (
              <span key={p} className="badge badge--accent" title={t("agents.section_protocols")}>{p}</span>
            ))}
            {shared_protocols.length > 2 && (
              <span className="badge badge--accent" title={shared_protocols.slice(2).join(", ")}>+{shared_protocols.length - 2}</span>
            )}
          </div>
        </div>
      </div>

      {soul && <p className="agent-card__soul">{soul}</p>}
      {description && <p className="stat-card__extra">{description}</p>}

      <div className="agent-card__footer">
        {use_count > 0 && (
          <span className="stat-card__extra">{t("agents.used_count", { count: String(use_count) })}</span>
        )}
        <div className="agent-card__actions">
          <button
            className="btn btn--xs btn--accent"
            onClick={() => onUse(definition)}
            aria-label={t("agents.use")}
          >
            {t("agents.use")}
          </button>
          {is_builtin ? (
            <button className="btn btn--xs" onClick={() => onFork(id)} aria-label={t("agents.fork")}>
              {t("agents.fork")}
            </button>
          ) : (
            <>
              <button className="btn btn--xs" onClick={() => onEdit(definition)} aria-label={t("common.edit")}>
                {t("common.edit")}
              </button>
              <button className="btn btn--xs btn--danger" onClick={() => onDelete(id)} aria-label={t("common.remove")}>
                {t("common.remove")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
