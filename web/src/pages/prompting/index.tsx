/**
 * Prompting — 통합 도메인 메인 페이지.
 *
 * 탭 구성 (11개):
 *   [Creative] Text | Image | Video | Agent | Gallery | Compare | Eval
 *   [Manage]   Skills | Templates | Tools | RAG
 */
import { useState, lazy, Suspense } from "react";
import { useT } from "../../i18n";

const TextPanel    = lazy(() => import("./text-panel").then(m => ({ default: m.TextPanel })));
const ImagePanel   = lazy(() => import("./image-panel").then(m => ({ default: m.ImagePanel })));
const VideoPanel   = lazy(() => import("./video-panel").then(m => ({ default: m.VideoPanel })));
const AgentPanel   = lazy(() => import("./agent-panel").then(m => ({ default: m.AgentPanel })));
const GalleryPanel = lazy(() => import("./gallery-panel").then(m => ({ default: m.GalleryPanel })));
const ComparePanel = lazy(() => import("./compare-panel").then(m => ({ default: m.ComparePanel })));
const EvalPanel    = lazy(() => import("./eval-panel").then(m => ({ default: m.EvalPanel })));

const SkillsPanel    = lazy(() => import("../workspace/skills").then(m => ({ default: m.SkillsTab })));
const TemplatesPanel = lazy(() => import("../workspace/templates").then(m => ({ default: m.TemplatesTab })));
const ToolsPanel     = lazy(() => import("../workspace/tools").then(m => ({ default: m.ToolsTab })));
const RAGPanel       = lazy(() => import("../workspace/references").then(m => ({ default: m.ReferencesTab })));

type CreativeTab = "text" | "image" | "video" | "agent" | "gallery" | "compare" | "eval";
type ManageTab   = "skills" | "templates" | "tools" | "rag";
type Tab = CreativeTab | ManageTab;

const CREATIVE_TABS: { id: CreativeTab; label_key: string; icon: string }[] = [
  { id: "text",    label_key: "prompting.tab_text",    icon: "T"  },
  { id: "image",   label_key: "prompting.tab_image",   icon: "◎"  },
  { id: "video",   label_key: "prompting.tab_video",   icon: "▷"  },
  { id: "agent",   label_key: "prompting.tab_agent",   icon: "🤖" },
  { id: "gallery", label_key: "prompting.tab_gallery", icon: "◈"  },
  { id: "compare", label_key: "prompting.tab_compare", icon: "⚖"  },
  { id: "eval",    label_key: "prompting.tab_eval",    icon: "✓"  },
];

const MANAGE_TABS: { id: ManageTab; label_key: string; icon: string }[] = [
  { id: "skills",    label_key: "prompting.tab_skills",    icon: "⚡"  },
  { id: "templates", label_key: "prompting.tab_templates", icon: "📋" },
  { id: "tools",     label_key: "prompting.tab_tools",     icon: "🔩" },
  { id: "rag",       label_key: "prompting.tab_rag",       icon: "📚" },
];

export default function PromptingPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("text");
  const [agent_initial_id, setAgentInitialId] = useState<string | undefined>(undefined);

  const go_to_agent = (id?: string) => {
    setAgentInitialId(id ?? "__new__");
    setTab("agent");
  };

  return (
    <div className="ps-page">
      <nav className="ps-tabs" role="tablist" aria-label={t("prompting.nav_label")}>
        {/* ── Creative section ── */}
        <div className="ps-tabs__creative">
          {CREATIVE_TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              className={`ps-tab${tab === item.id ? " ps-tab--active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="ps-tab__icon" aria-hidden="true">{item.icon}</span>
              {t(item.label_key)}
            </button>
          ))}
        </div>

        {/* ── Separator ── */}
        <div className="ps-tabs__sep" aria-hidden="true" />

        {/* ── Manage section ── */}
        <div className="ps-tabs__manage">
          {MANAGE_TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              className={`ps-tab ps-tab--manage${tab === item.id ? " ps-tab--active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="ps-tab__icon" aria-hidden="true">{item.icon}</span>
              {t(item.label_key)}
            </button>
          ))}
        </div>
      </nav>

      <div className="ps-body" role="tabpanel">
        <Suspense fallback={<div className="ps-loading" />}>
          {tab === "text"      && <TextPanel />}
          {tab === "image"     && <ImagePanel />}
          {tab === "video"     && <VideoPanel />}
          {tab === "agent"     && <AgentPanel initial_id={agent_initial_id} />}
          {tab === "gallery"   && <GalleryPanel onGoToAgent={go_to_agent} />}
          {tab === "compare"   && <ComparePanel />}
          {tab === "eval"      && <EvalPanel />}
          {tab === "skills"    && <SkillsPanel />}
          {tab === "templates" && <TemplatesPanel />}
          {tab === "tools"     && <ToolsPanel />}
          {tab === "rag"       && <RAGPanel />}
        </Suspense>
      </div>
    </div>
  );
}
