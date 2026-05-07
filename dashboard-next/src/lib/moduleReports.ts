import fs from "fs/promises";
import path from "path";

export type ModuleReportItem = {
  id: string;
  title: string;
  htmlPath: string;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function listModuleReports(moduleReportsDir: string): Promise<ModuleReportItem[]> {
  // Convention: module_reports/<id>/report.html
  try {
    const entries = await fs.readdir(moduleReportsDir, { withFileTypes: true });
    const items: ModuleReportItem[] = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const id = ent.name;
      const htmlPath = path.join(moduleReportsDir, id, "report.html");
      if (!(await exists(htmlPath))) continue;

      const title = id
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());

      items.push({ id, title, htmlPath });
    }

    return items.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
