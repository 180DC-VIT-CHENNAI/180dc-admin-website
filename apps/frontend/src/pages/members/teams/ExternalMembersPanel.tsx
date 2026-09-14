/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";

/**
 * The instance's pool of outside people — anyone not registered on the website
 * (other-college participants, client contacts, alumni). They live at instance
 * level and are then placed onto teams, so the same person can sit on two teams
 * without being typed in twice.
 */
export default function ExternalMembersPanel({ instance, canManage, open, setOpen, onCreate, onUpdate, onDelete }: {
  instance: any;
  canManage: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreate: (payload: any) => Promise<boolean>;
  onUpdate: (ext: any, patch: any) => Promise<boolean>;
  onDelete: (ext: any) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>({ name: "", email: "", organization: "" });

  const externals: any[] = instance.externals || [];
  const onTeams = new Map<string, number>();
  for (const g of instance.groups || []) {
    for (const t of g.teams || []) for (const m of t.members || []) {
      if (m.kind === "external") onTeams.set(m.external_id, (onTeams.get(m.external_id) || 0) + 1);
    }
  }
  for (const t of instance.ungrouped_teams || []) {
    for (const m of t.members || []) {
      if (m.kind === "external") onTeams.set(m.external_id, (onTeams.get(m.external_id) || 0) + 1);
    }
  }

  async function create() {
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true); setError(null);
    const ok = await onCreate({ name: name.trim(), email: email.trim() || undefined, organization: org.trim() || undefined });
    setBusy(false);
    if (ok) { setName(""); setEmail(""); setOrg(""); }
  }

  async function saveEdit(ext: any) {
    if (!editDraft.name.trim()) return;
    const ok = await onUpdate(ext, {
      name: editDraft.name.trim(),
      email: editDraft.email.trim() || null,
      organization: editDraft.organization.trim() || null,
    });
    if (ok) setEditId(null);
  }

  return (
    <div style={{ marginTop: "1.25rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--surface)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", textAlign: "left" }}
      >
        <span className="material-symbols-outlined" style={{ transition: "transform 140ms ease", transform: open ? "none" : "rotate(-90deg)" }}>expand_more</span>
        <span className="material-symbols-outlined" style={{ color: "#b45309" }}>person_pin</span>
        <strong style={{ fontSize: 14 }}>Outside members</strong>
        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(245, 158, 11, 0.14)", color: "#b45309" }}>
          {externals.length}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>people who aren't registered on the website</span>
      </button>

      {open && (
        <div style={{ padding: "0 1rem 1rem" }}>
          {externals.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", margin: "0 0 12px" }}>
              None yet. Add someone here first, then place them on a team.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: canManage ? 16 : 0 }}>
            {externals.map((ext: any) => (
              <div key={ext.id} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--surface-container-low)", border: "1px solid var(--border-light)" }}>
                {editId === ext.id ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Name" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Email" value={editDraft.email} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
                    <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Organisation" value={editDraft.organization} onChange={(e) => setEditDraft({ ...editDraft, organization: e.target.value })} />
                    <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => saveEdit(ext)}>Save</button>
                    <button className="btn outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div className="avatar-circle" style={{ width: 26, height: 26, fontSize: 11, background: "rgba(245, 158, 11, 0.20)", color: "#b45309" }}>
                      {ext.name[0]?.toUpperCase()}
                    </div>
                    <strong style={{ fontSize: 13 }}>{ext.name}</strong>
                    {ext.organization && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ext.organization}</span>}
                    {ext.email && <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ext.email}</span>}
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>
                      on {onTeams.get(ext.id) || 0} team{(onTeams.get(ext.id) || 0) === 1 ? "" : "s"}
                    </span>
                    {canManage && (
                      <>
                        <button className="btn outline" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setEditId(ext.id); setEditDraft({ name: ext.name, email: ext.email || "", organization: ext.organization || "" }); }}>Edit</button>
                        <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={() => onDelete(ext)}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <div style={{ padding: 12, borderRadius: 10, background: "var(--surface-container-low)", border: "1px dashed var(--outline-variant)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>ADD AN OUTSIDE MEMBER</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Name (required)" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Organisation (optional)" value={org} onChange={(e) => setOrg(e.target.value)} />
                <button className="btn" disabled={busy} onClick={create}>
                  <span className="material-symbols-outlined">person_add</span>
                  {busy ? "Adding..." : "Add"}
                </button>
              </div>
              {error && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
