import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";
import { RECRUITMENT_DOMAINS } from "./constants";

export default function RecruitmentSettingsSection({ authToken }: { authToken: string }) {
  const [settings, setSettings] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(apiUrl("/api/recruitment/admin/settings"), { headers: { Authorization: `Bearer ${authToken}` } });
    const d = await res.json();
    if (d.success) setSettings(d.data || []);
  }

  useEffect(() => { load(); }, []);

  async function toggleDomain(domainName: string) {
    const newSettings = settings.map(s => s.domain_name === domainName ? { ...s, is_open: s.is_open ? 0 : 1 } : s);
    setSettings(newSettings);
    const openDomains = newSettings.filter((s: any) => s.is_open).map((s: any) => s.domain_name);
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains }),
      });
    } finally { setBusy(false); }
  }

  async function selectAll() {
    setSettings(RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 1 })));
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains: RECRUITMENT_DOMAINS }),
      });
    } finally { setBusy(false); }
  }

  async function deselectAll() {
    setSettings(RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 0 })));
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains: [] }),
      });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h3>Recruitment Domain Settings</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
        Open or close recruitment for each domain. Closed domains won't appear on the application form.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {(settings.length > 0 ? settings : RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 1 }))).map((ds: any) => (
          <button
            key={ds.domain_name}
            onClick={() => toggleDomain(ds.domain_name)}
            disabled={busy}
            className="btn"
            style={{
              padding: "0.4rem 1rem", fontSize: 13,
              background: ds.is_open ? "var(--primary-green)" : "var(--bg-secondary)",
              color: ds.is_open ? "#fff" : "var(--text-secondary)",
              border: ds.is_open ? "none" : "1px solid var(--border-light)",
            }}
          >
            {ds.is_open ? "✓ " : "✕ "}{ds.domain_name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={busy} onClick={selectAll}>Select All</button>
        <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={busy} onClick={deselectAll}>Deselect All</button>
      </div>
    </div>
  );
}
