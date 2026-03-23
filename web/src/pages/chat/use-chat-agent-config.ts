import { useState } from "react";
import { compose_agent_prompt } from "./agent-context-bar";
import type { AgentDefinition } from "../../../../src/agent/agent-definition.types";
import type { MentionItem } from "../../components/mention-picker";
import type { UnifiedSelectorItem } from "../../components/shared/prompt-bar";

export interface ChatAgentConfig {
  activeDefinition: AgentDefinition | null;
  systemPromptOverride: string;
  selectedProvider: string;
  selectedModel: string;
  attached_items: MentionItem[];
  tool_choice: "auto" | "manual" | "none";
  capabilities: Set<string>;
  setSystemPromptOverride: (v: string) => void;
  setSelectedProvider: (v: string) => void;
  setSelectedModel: (v: string) => void;
  setToolChoice: (v: "auto" | "manual" | "none") => void;
  setCapabilities: (updater: (prev: Set<string>) => Set<string>) => void;
  handle_mention_select: (item: MentionItem, agentDefs: AgentDefinition[]) => void;
  handle_mention_remove: (id: string) => void;
  handle_tool_add: (item: UnifiedSelectorItem, agentDefs: AgentDefinition[]) => void;
  handle_endpoint_change: (ep: { type: string; id: string; label: string }, agentDefs: AgentDefinition[]) => void;
}

export function useChatAgentConfig(init_def: AgentDefinition | null): ChatAgentConfig {
  const [activeDefinition, setActiveDefinition] = useState<AgentDefinition | null>(init_def);
  const [systemPromptOverride, setSystemPromptOverride] = useState(() =>
    init_def ? compose_agent_prompt(init_def) : ""
  );
  const [selectedProvider, setSelectedProvider] = useState(init_def?.preferred_providers[0] ?? "");
  const [selectedModel, setSelectedModel] = useState(init_def?.model ?? "");
  const [attached_items, setAttachedItems] = useState<MentionItem[]>([]);
  const [tool_choice, setToolChoice] = useState<"auto" | "manual" | "none">("auto");
  const [capabilities, setCapabilities] = useState<Set<string>>(new Set(["web_search"]));

  const handle_mention_select = (item: MentionItem, agentDefs: AgentDefinition[]) => {
    if (item.type === "agent") {
      const def = agentDefs.find((d) => d.id === item.id) ?? null;
      setActiveDefinition(def);
      if (def) {
        setSystemPromptOverride(compose_agent_prompt(def));
        setSelectedProvider(def.preferred_providers[0] ?? "");
        setSelectedModel(def.model ?? "");
      }
    } else {
      setAttachedItems((prev) => prev.some((i) => i.id === item.id) ? prev : [...prev, item]);
    }
  };

  const handle_mention_remove = (id: string) => {
    setAttachedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handle_tool_add = (item: UnifiedSelectorItem, agentDefs: AgentDefinition[]) => {
    const mention_type: MentionItem["type"] =
      item.type === "mcp-tool" || item.type === "app-tool" ? "tool" :
      item.type === "workflow" ? "workflow" :
      "agent";
    handle_mention_select({ type: mention_type, id: item.id, name: item.name, description: item.description }, agentDefs);
  };

  const handle_endpoint_change = (ep: { type: string; id: string; label: string }, agentDefs: AgentDefinition[]) => {
    setSelectedModel(ep.id);
    if (ep.type === "agent") {
      const def = agentDefs.find((d) => d.id === ep.id) ?? null;
      if (def) {
        setActiveDefinition(def);
        setSystemPromptOverride(compose_agent_prompt(def));
        setSelectedProvider(def.preferred_providers[0] ?? "");
      }
    }
  };

  return {
    activeDefinition,
    systemPromptOverride,
    selectedProvider,
    selectedModel,
    attached_items,
    tool_choice,
    capabilities,
    setSystemPromptOverride,
    setSelectedProvider,
    setSelectedModel,
    setToolChoice,
    setCapabilities,
    handle_mention_select,
    handle_mention_remove,
    handle_tool_add,
    handle_endpoint_change,
  };
}
