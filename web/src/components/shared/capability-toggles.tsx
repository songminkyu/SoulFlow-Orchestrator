/**
 * CapabilityToggles — 웹 검색, 코드 실행 등 고수준 기능 on/off 토글 패널.
 * 각 capability는 백엔드 도구 카테고리/이름에 매핑되어
 * 메시지 전송 시 enabled_capabilities 필드로 전달됨.
 */
import { useT } from "../../i18n";

export interface Capability {
  id: string;
  icon: string;
  /** i18n 키 접두사. `${prefix}.label`, `${prefix}.desc` */
  i18n_prefix: string;
}

export const CAPABILITIES: Capability[] = [
  { id: "web_search",   icon: "\uD83D\uDD0D", i18n_prefix: "capability.web_search" },
  { id: "code_exec",    icon: "\uD83D\uDCBB", i18n_prefix: "capability.code_exec" },
  { id: "web_content",  icon: "\uD83C\uDF10", i18n_prefix: "capability.web_content" },
  { id: "image_gen",    icon: "\uD83C\uDFA8", i18n_prefix: "capability.image_gen" },
];

export interface CapabilityTogglesProps {
  enabled: Set<string>;
  onChange: (id: string, on: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function CapabilityToggles({ enabled, onChange, disabled, className }: CapabilityTogglesProps) {
  const t = useT();

  return (
    <div className={`capability-toggles${className ? ` ${className}` : ""}`}>
      <div className="capability-toggles__header">
        {t("capability.header")}
      </div>
      {CAPABILITIES.map((cap) => {
        const on = enabled.has(cap.id);
        return (
          <label
            key={cap.id}
            className={`capability-toggles__row${on ? " capability-toggles__row--on" : ""}`}
          >
            <span className="capability-toggles__icon" aria-hidden="true">
              {cap.icon}
            </span>
            <span className="capability-toggles__info">
              <span className="capability-toggles__label">
                {t(`${cap.i18n_prefix}.label`)}
              </span>
              <span className="capability-toggles__desc">
                {t(`${cap.i18n_prefix}.desc`)}
              </span>
            </span>
            <input
              type="checkbox"
              className="capability-toggles__switch"
              checked={on}
              onChange={(e) => onChange(cap.id, e.target.checked)}
              disabled={disabled}
              aria-label={t(`${cap.i18n_prefix}.label`)}
            />
          </label>
        );
      })}
    </div>
  );
}
