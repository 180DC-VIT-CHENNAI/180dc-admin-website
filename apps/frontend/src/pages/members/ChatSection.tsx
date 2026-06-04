import { useState, useEffect, useRef } from "react";
import { apiUrl } from "../../lib/api";

interface ChatSectionProps {
  authToken: string;
}

interface ChatUser {
  userId: string;
  userName: string;
  userRole: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  content: string;
  timestamp: number;
}

export default function ChatSection({ authToken }: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch(apiUrl("/api/chat/init"), {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (!data.success || !data.sessionId) {
          setError(data.error || "Failed to initialize chat");
          return;
        }

        const apiBase =
          import.meta.env.VITE_API_BASE_URL ||
          (import.meta.env.DEV ? "http://127.0.0.1:8787" : window.location.origin);
        const wsBase = apiBase.replace(/^http/, "ws");
        const wsUrl = `${wsBase}/api/chat/ws?sessionId=${data.sessionId}`;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (cancelled) { socket.close(); return; }
          setConnected(true);
          setError("");
        };

        socket.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "history":
                setMessages(msg.messages || []);
                setOnlineUsers(msg.onlineUsers || []);
                break;
              case "message":
                setMessages((prev) => [...prev, msg]);
                break;
              case "user_joined":
                setOnlineUsers((prev) => {
                  if (prev.find((u) => u.userId === msg.userId)) return prev;
                  return [...prev, { userId: msg.userId, userName: msg.userName, userRole: msg.userRole }];
                });
                break;
              case "user_left":
                setOnlineUsers((prev) => prev.filter((u) => u.userId !== msg.userId));
                setTypingUserIds((prev) => { const n = new Set(prev); n.delete(msg.userId); return n; });
                break;
              case "typing":
                setTypingUserIds((prev) => {
                  const n = new Set(prev);
                  if (msg.active) n.add(msg.userId);
                  else n.delete(msg.userId);
                  return n;
                });
                break;
            }
          } catch { /* ignore */ }
        };

        socket.onclose = () => {
          if (cancelled) return;
          setConnected(false);
          setOnlineUsers([]);
        };

        socket.onerror = () => {
          if (cancelled) return;
          setError("Connection error");
          setConnected(false);
        };
      } catch (e) {
        if (!cancelled) setError("Failed to connect: " + (e instanceof Error ? e.message : String(e)));
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [authToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", content }));
    setInput("");
  }

  function handleInputChange(value: string) {
    setInput(value);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "typing", active: true }));
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing", active: false }));
      }
    }, 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const typingNames = Array.from(typingUserIds)
    .map((id) => onlineUsers.find((u) => u.userId === id)?.userName)
    .filter(Boolean);

  return (
    <div className="members-grid">
      <div className="card-doodle" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", minHeight: 400 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
          <h3 style={{ margin: 0 }}>Chat</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--primary-green)" : "#e74c3c", display: "inline-block" }} />
            <span style={{ color: "var(--text-secondary)" }}>{connected ? `${onlineUsers.length} online` : "Disconnected"}</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: 12, background: "#fff0f0", borderRadius: 8, marginTop: 8, fontSize: 13, color: "#c00" }}>{error}</div>
        )}

        <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 12, marginTop: 12 }}>
          {/* Messages area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 8 }}>
              {messages.length === 0 && connected && (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, padding: "2rem 0" }}>
                  No messages yet. Start the conversation!
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  maxWidth: "80%",
                }}>
                  <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 2 }}>
                    <strong>{msg.userName}</strong> ({msg.userRole.replace(/_/g, " ")})
                  </div>
                  <div style={{
                    padding: "8px 14px",
                    borderRadius: 16,
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-light)", padding: "4px 0", fontStyle: "italic" }}>
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Input area */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
              <textarea
                className="input"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connected ? "Type a message..." : "Connecting..."}
                rows={2}
                disabled={!connected}
                style={{ flex: 1, resize: "none" }}
              />
              <button className="btn" onClick={sendMessage} disabled={!connected || !input.trim()} style={{ alignSelf: "flex-end" }}>
                Send
              </button>
            </div>
          </div>

          {/* Online users sidebar */}
          <div style={{
            width: 200,
            flexShrink: 0,
            borderLeft: "1px solid var(--border-light)",
            paddingLeft: 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Online</div>
            {onlineUsers.map((u) => (
              <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "4px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary-green)", display: "inline-block", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.userName}</span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-light)" }}>No one online</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
