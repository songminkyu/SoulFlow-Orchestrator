/** Dashboard workspace ops. */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sanitize_rel_path, is_inside } from "./shared.js";
import type { DashboardWorkspaceOps } from "../service.js";

export function create_workspace_ops(workspace_dir: string): DashboardWorkspaceOps {
  return {
    async list_files(rel_path = "") {
      const safe = sanitize_rel_path(rel_path, workspace_dir);
      if (!safe && rel_path) return [];
      const abs = join(workspace_dir, safe);
      // TN-6d: is_inside 방어 심층 — sanitize_rel_path 우회 시 2차 차단
      if (!is_inside(workspace_dir, abs)) return [];
      try {
        const entries = readdirSync(abs, { withFileTypes: true });
        return entries.map((e) => {
          const rel = safe ? `${safe}/${e.name}` : e.name;
          let size = 0; let mtime = 0;
          try { const st = statSync(join(abs, e.name)); size = st.size; mtime = st.mtimeMs; } catch { /* skip */ }
          return { name: e.name, rel, is_dir: e.isDirectory(), size, mtime };
        });
      } catch { return []; }
    },
    async read_file(rel_path) {
      const safe = sanitize_rel_path(rel_path, workspace_dir);
      if (!safe && rel_path) return null;
      const abs = join(workspace_dir, safe);
      if (!is_inside(workspace_dir, abs)) return null;
      try { return readFileSync(abs, "utf-8"); } catch { return null; }
    },
  };
}
