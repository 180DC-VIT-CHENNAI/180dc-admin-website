import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function ProjectTasksSection({ authToken, projectId, projectStatus, canManageTasks, isBoard }: { authToken: string; projectId: string; projectStatus: string; canManageTasks: boolean; isBoard: boolean }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [completeAllBusy, setCompleteAllBusy] = useState(false);
  const [completeProjBusy, setCompleteProjBusy] = useState(false);

  async function loadTasks() {
    const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks`), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setTasks(data.data || []);
  }

  useEffect(() => { loadTasks(); }, []);

  const allDone = tasks.length > 0 && tasks.every((t: any) => t.status === "completed");

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Tasks ({tasks.filter((t: any) => t.status === "completed").length}/{tasks.length})</strong>
        {projectStatus !== "completed" && (
          <div style={{ display: "flex", gap: 6 }}>
            {canManageTasks && tasks.length > 0 && !allDone && (
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={completeAllBusy} onClick={async () => {
                setCompleteAllBusy(true);
                try {
                  const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks/complete-all`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json();
                  if (data.success) loadTasks();
                  else alert(data.error);
                } finally { setCompleteAllBusy(false); }
              }}>{completeAllBusy ? "Completing..." : "Complete All"}</button>
            )}
            {isBoard && projectStatus !== "completed" && (allDone || tasks.length === 0) && (
              <button className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={completeProjBusy} onClick={async () => {
                setCompleteProjBusy(true);
                try {
                  const res = await fetch(apiUrl(`/api/projects/${projectId}/complete`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json();
                  if (data.success) { alert("Project marked as complete"); loadTasks(); window.location.reload(); }
                  else alert(data.error);
                } finally { setCompleteProjBusy(false); }
              }}>{completeProjBusy ? "Completing..." : "Mark Project Complete"}</button>
            )}
          </div>
        )}
      </div>

      {tasks.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0" }}>No tasks yet.</p>}

      <div style={{ display: "grid", gap: 4 }}>
        {tasks.map((t: any) => (
          <div key={t.id} style={{ padding: "0.4rem 0.7rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, color: t.status === "completed" ? "var(--primary-green)" : "var(--text-light)" }}>
                  {t.status === "completed" ? "✓" : "○"}
                </span>
                <strong style={{ fontSize: 13 }}>{t.title}</strong>
              </div>
              {t.description && <p style={{ margin: "2px 0 0 20px", fontSize: 12, color: "var(--text-secondary)" }}>{t.description}</p>}
            </div>
            {canManageTasks && t.status !== "completed" && (
              <button className="btn outline" style={{ padding: "0.2rem 0.5rem", fontSize: 11 }} onClick={async () => {
                const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks/${t.id}`), {
                  method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                  body: JSON.stringify({ status: "completed" }),
                });
                const data = await res.json();
                if (data.success) loadTasks();
              }}>Complete</button>
            )}
          </div>
        ))}
      </div>

      {canManageTasks && projectStatus !== "completed" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 2, minWidth: 150 }} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <input className="input" style={{ flex: 3, minWidth: 200 }} placeholder="Description (optional)" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
          <button className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={taskBusy} onClick={async () => {
            if (!taskTitle.trim()) return alert("Task title required");
            setTaskBusy(true);
            try {
              const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks`), {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ title: taskTitle.trim(), description: taskDesc.trim() || null }),
              });
              const data = await res.json();
              if (data.success) { setTaskTitle(""); setTaskDesc(""); loadTasks(); }
              else alert(data.error);
            } finally { setTaskBusy(false); }
          }}>{taskBusy ? "Adding..." : "Add Task"}</button>
        </div>
      )}
    </div>
  );
}
