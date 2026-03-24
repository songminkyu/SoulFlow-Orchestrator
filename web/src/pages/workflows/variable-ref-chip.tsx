/**
 * VariableRefChip (B1.1): 워크플로우 노드 간 변수 참조를 시각적 칩으로 표시.
 * `{{node_id.field_name}}` 형태의 참조를 색상 코딩된 인라인 칩으로 렌더링.
 * 기존 `.field-type[data-ft]` 색상 체계(port-string, port-number 등)를 재사용.
 */

export interface VariableRef {
  node_id: string;
  field_name: string;
  field_type: string;
  required?: boolean;
}

export interface VariableRefChipProps {
  vref: VariableRef;
  onRemove?: () => void;
}

export function VariableRefChip({ vref, onRemove }: VariableRefChipProps) {
  return (
    <span className="var-ref-chip" data-ft={vref.field_type} title={`{{${vref.node_id}.${vref.field_name}}}`}>
      <span className="var-ref-chip__node">{vref.node_id}</span>
      <span className="var-ref-chip__dot">.</span>
      <span className="var-ref-chip__field">{vref.field_name}</span>
      <span className="var-ref-chip__type" data-ft={vref.field_type}>{vref.field_type}</span>
      {vref.required && <span className="var-ref-chip__required" aria-label="required">*</span>}
      {onRemove && (
        <button
          type="button"
          className="var-ref-chip__remove"
          onClick={onRemove}
          aria-label={`Remove ${vref.node_id}.${vref.field_name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

/**
 * VariableRefDropdown: upstream 노드의 출력 필드를 선택 가능한 드롭다운.
 * textarea에 `{{node_id.field_name}}` 텍스트를 삽입하는 용도.
 */
export interface VariableRefDropdownProps {
  upstream_refs: Array<{ node_id: string; node_label: string; fields: Array<{ name: string; type: string; description?: string }> }>;
  onSelect: (ref_text: string) => void;
  className?: string;
}

export function VariableRefDropdown({ upstream_refs, onSelect, className }: VariableRefDropdownProps) {
  if (upstream_refs.length === 0) return null;

  return (
    <div className={`var-ref-dropdown${className ? ` ${className}` : ""}`}>
      {upstream_refs.map((node) => (
        <div key={node.node_id} className="var-ref-dropdown__group">
          <div className="var-ref-dropdown__group-label">{node.node_label || node.node_id}</div>
          {node.fields.map((field) => (
            <button
              key={`${node.node_id}.${field.name}`}
              type="button"
              className="var-ref-dropdown__item"
              onClick={() => onSelect(`{{${node.node_id}.${field.name}}}`)}
            >
              <span className="var-ref-dropdown__field-name">{field.name}</span>
              <span className="var-ref-dropdown__field-type" data-ft={field.type}>{field.type}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
