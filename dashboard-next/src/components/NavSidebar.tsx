"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { href: "/", label: "Command Center", icon: "⬡" },
      { href: "/showcase", label: "Live Pipeline Demo", icon: "▶" },
    ],
  },
  {
    title: "THREAT COMMAND",
    items: [
      { href: "/dashboard", label: "A–H Dashboard", icon: "◈" },
      { href: "/alerts", label: "Live Alerts", icon: "◉" },
      { href: "/threat-intel", label: "Threat Intelligence", icon: "◎" },
    ],
  },
  {
    title: "DETECTION MODULES",
    items: [
      { href: "/detection/network", label: "Network (GNN+FT)", icon: "◇" },
      { href: "/detection/text", label: "Text / Email", icon: "◈" },
      { href: "/url-check", label: "URL / Web", icon: "◆" },
      { href: "/detection/anomaly", label: "Anomaly Detection", icon: "◉" },
    ],
  },
  {
    title: "ANALYSIS",
    items: [
      { href: "/explainability", label: "X-TIS Explainability", icon: "◎" },
      { href: "/metrics", label: "Model Metrics", icon: "◈" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/pipeline", label: "Pipeline Runner", icon: "▷" },
      { href: "/reports", label: "Reports", icon: "◇" },
      { href: "/simulation", label: "Attack Simulation", icon: "◆" },
    ],
  },
  {
    title: "ARCHIVE",
    items: [
      { href: "/detections", label: "E–H Detections", icon: "◉" },
      { href: "/module-reports", label: "Module Reports", icon: "◎" },
      { href: "/project", label: "System Overview", icon: "◈" },
    ],
  },
];

export default function NavSidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="h-full border-r overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <nav className="p-3 space-y-4">
        {NAV.map((section) => (
          <div key={section.title}>
            <div
              className="px-2 py-1 text-xs font-semibold tracking-widest uppercase mb-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item flex items-center gap-2.5 rounded-r px-3 py-2 text-sm transition-all ${
                    isActive(item.href) ? "nav-active" : ""
                  }`}
                  style={
                    isActive(item.href)
                      ? {}
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  <span className="text-xs shrink-0" style={{ color: isActive(item.href) ? "#3b82f6" : "var(--muted-foreground)" }}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
