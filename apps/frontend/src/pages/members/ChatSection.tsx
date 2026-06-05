import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { apiUrl } from "../../lib/api";

function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return mobile;
}

interface ChatSectionProps {
  authToken: string;
  room: string;
  roomName: string;
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
  mentions?: string[];
  isTestAccount?: boolean;
}

interface PollData {
  id: string;
  creatorId: string;
  creatorName: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  active: boolean;
  timestamp: number;
}

interface PollMessage {
  id: string;
  type: "poll";
  poll: PollData;
  userId: string;
  userName: string;
  userRole: string;
  timestamp: number;
  isTestAccount?: boolean;
}

type ChatEntry = ChatMessage | PollMessage;

const POLL_OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB");
}

function groupByDate(entries: ChatEntry[]): { dateLabel: string; entries: ChatEntry[] }[] {
  const groups: { dateLabel: string; entries: ChatEntry[] }[] = [];
  let lastLabel = "";
  for (const e of entries) {
    const label = formatDateLabel(e.timestamp);
    if (label !== lastLabel) {
      groups.push({ dateLabel: label, entries: [e] });
      lastLabel = label;
    } else {
      groups[groups.length - 1].entries.push(e);
    }
  }
  return groups;
}

function renderContent(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = [];
  const regex = /@(\w+)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(<span key={match.index} style={{ color: "#3498db", fontWeight: 600 }}>@{match[1]}</span>);
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export default function ChatSection({ authToken, room, roomName }: ChatSectionProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [sending, setSending] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<{ text: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const isMobile = useIsMobile();
  const storageKey = useMemo(() => `chat_online_visible_${room}`, [room]);
  const [showOnline, setShowOnline] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved !== null ? saved === "true" : !isMobile;
  });
  const wsRef = useRef<WebSocket | null>(null);
  const connIdRef = useRef<string>("");
  const typingTimer = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const reconnectRef = useRef<number>(0);
  const heartbeatRef = useRef<number>(0);
  const retriesRef = useRef(0);

  function toggleOnline() {
    setShowOnline((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  useEffect(() => {
    setEntries([]);
    setOnlineUsers([]);
    setCurrentUser(null);
    setError("");
  }, [room]);

  const isPoll = (e: ChatEntry): e is PollMessage => "type" in e && e.type === "poll";

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch(apiUrl("/api/chat/init"), {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ room }),
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
        const wsUrl = `${wsBase}/api/chat/ws?sessionId=${data.sessionId}&room=${encodeURIComponent(room)}`;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (cancelled) { socket.close(); return; }
          retriesRef.current = 0;
          setConnected(true);
          setError("");
          heartbeatRef.current = window.setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "ping", connId: connIdRef.current }));
            }
          }, 30000);
        };

        socket.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "history":
                setEntries(msg.messages || []);
                setOnlineUsers(msg.onlineUsers || []);
                if (msg.currentUser) setCurrentUser(msg.currentUser);
                if (msg.connId) connIdRef.current = msg.connId;
                break;
              case "message": {
                setEntries((prev) => [...prev, msg]);
                break;
              }
              case "poll":
              case "poll_created": {
                setEntries((prev) => [...prev, msg]);
                break;
              }
              case "poll_updated": {
                const updatedPoll = msg.poll;
                setEntries((prev) => prev.map((e) => (isPoll(e) && e.id === updatedPoll.id ? { ...e, poll: updatedPoll } : e)));
                break;
              }
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
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = 0; }
          if (retriesRef.current < 10) {
            const delay = Math.min(1000 * Math.pow(1.5, retriesRef.current), 15000);
            retriesRef.current++;
            reconnectRef.current = window.setTimeout(connect, delay);
          }
        };

        socket.onerror = () => {
          if (cancelled) return;
          setError("Connection error, reconnecting...");
          setConnected(false);
        };
      } catch (e) {
        if (!cancelled) {
          setError("Failed to connect: " + (e instanceof Error ? e.message : String(e)));
          if (retriesRef.current < 10) {
            const delay = Math.min(1000 * Math.pow(1.5, retriesRef.current), 15000);
            retriesRef.current++;
            reconnectRef.current = window.setTimeout(connect, delay);
          }
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (wsRef.current) wsRef.current.close();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [authToken, reconnectKey, room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected. Waiting for reconnection...");
      return;
    }
    try {
      wsRef.current.send(JSON.stringify({ type: "message", content, connId: connIdRef.current }));
      setInput("");
      setMentionQuery(null);
    } catch (e) {
      setError("Failed to send: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [input]);

  function handleInputChange(value: string, selStart: number) {
    setInput(value);

    // Detect @mention being typed
    const beforeCursor = value.slice(0, selStart);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || beforeCursor[atIdx - 1] === " " || beforeCursor[atIdx - 1] === "\n")) {
      const query = beforeCursor.slice(atIdx + 1);
      if (!/\s/.test(query)) {
        setMentionQuery({ text: query.toLowerCase(), start: atIdx });
        setMentionIdx(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "typing", active: true, connId: connIdRef.current }));
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing", active: false, connId: connIdRef.current }));
      }
    }, 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIdx].userName);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function insertMention(userName: string) {
    if (!mentionQuery) return;
    const before = input.slice(0, mentionQuery.start);
    const after = input.slice(mentionQuery.start + 1 + mentionQuery.text.length);
    const mentionWord = userName.split(" ")[0];
    setInput(before + "@" + mentionWord + " " + after);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function reconnect() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = 0; }
    retriesRef.current = 0;
    setConnected(false);
    setOnlineUsers([]);
    setError("Reconnecting...");
    setReconnectKey((k) => k + 1);
  }

  function createPoll() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    setSending(true);
    try {
      wsRef.current.send(JSON.stringify({ type: "create_poll", question, options, connId: connIdRef.current }));
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowPollForm(false);
    } catch (e) {
      setError("Failed to create poll: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  }

  function vote(pollId: string, optionIndex: number) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({ type: "vote", pollId, optionIndex, connId: connIdRef.current }));
    } catch (e) {
      setError("Failed to vote: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function closePoll(pollId: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({ type: "close_poll", pollId, connId: connIdRef.current }));
    } catch (e) {
      setError("Failed to close poll: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function addPollOption() {
    if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
  }

  function updatePollOption(idx: number, val: string) {
    const next = [...pollOptions];
    next[idx] = val;
    setPollOptions(next);
  }

  function removePollOption(idx: number) {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  }

  const typingNames = Array.from(typingUserIds)
    .map((id) => onlineUsers.find((u) => u.userId === id)?.userName)
    .filter(Boolean);

  const mentionedMessageIds = new Set<string>();
  if (currentUser) {
    for (const e of entries) {
      if (!isPoll(e) && e.mentions?.includes(currentUser.userId)) {
        mentionedMessageIds.add(e.id);
      }
    }
  }

  const mentionSuggestions = mentionQuery
    ? onlineUsers.filter(
        (u) =>
          u.userId !== currentUser?.userId &&
          u.userName.split(" ")[0].toLowerCase().startsWith(mentionQuery.text),
      ).slice(0, 8)
    : [];

  const grouped = groupByDate(entries);

  return (
    <div className="members-grid">
      <div className="card-doodle" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", minHeight: 500 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {roomName}
            {mentionedMessageIds.size > 0 && (
              <span style={{ background: "#e74c3c", color: "#fff", fontSize: 11, borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
                {mentionedMessageIds.size}
              </span>
            )}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--primary-green)" : "#e74c3c", display: "inline-block" }} />
            <span style={{ color: "var(--text-secondary)" }}>{connected ? `${onlineUsers.length} online` : "Disconnected"}</span>
            <button
              onClick={toggleOnline}
              title={showOnline ? "Hide online users" : "Show online users"}
              style={{
                background: "none", border: "1px solid var(--border-light)", borderRadius: 4,
                cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 6px",
                color: showOnline ? "var(--primary-green)" : "var(--text-secondary)",
                opacity: showOnline ? 1 : 0.5,
              }}
            >{showOnline ? "👁" : "👁‍🗨"}</button>
            <button
              onClick={reconnect}
              title="Reload chat"
              style={{ background: "none", border: "1px solid var(--border-light)", borderRadius: 4, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 6px", color: "var(--text-secondary)" }}
            >&#x21bb;</button>
          </div>
        </div>

        {error && (
          <div style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: 8, marginTop: 8, fontSize: 13, color: "#e74c3c", border: "1px solid #e74c3c" }}>{error}</div>
        )}

        <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 12, marginTop: 12 }}>
          {/* Messages area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 8 }}>
              {entries.length === 0 && connected && (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, padding: "2rem 0" }}>
                  No messages yet. Start the conversation!
                </div>
              )}
              {grouped.map((group) => (
                <div key={group.dateLabel}>
                  <div style={{
                    textAlign: "center", fontSize: 12, color: "var(--text-light)", margin: "12px 0 8px",
                    position: "relative",
                  }}>
                    <span style={{ background: "var(--bg-primary)", padding: "0 12px", position: "relative", zIndex: 1 }}>{group.dateLabel}</span>
                  </div>
                  {group.entries.map((entry) => {
                    if (isPoll(entry)) {
                      const p = entry.poll;
                      const votedOption = p.votes[currentUser?.userId || ""];
                      const totalVotes = Object.keys(p.votes).length;
                      const isCreator = currentUser?.userId === p.creatorId;
                      return (
                        <div key={entry.id} style={{
                          maxWidth: "90%", marginBottom: 8, border: "1px solid var(--border-light)",
                          borderRadius: 12, padding: 12, background: "var(--bg-secondary)",
                        }}>
                          <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 4 }}>
                            Poll by <strong>{p.creatorName}</strong>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{p.question}</div>
                          {p.options.map((opt, idx) => {
                            const voteCount = Object.values(p.votes).filter((v) => v === idx).length;
                            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                            const isSelected = votedOption === idx;
                            return (
                              <div key={idx} style={{ marginBottom: 6 }}>
                                <button
                                  onClick={() => p.active && votedOption === undefined ? vote(p.id, idx) : null}
                                  disabled={!p.active || votedOption !== undefined}
                                  title={!p.active ? "Poll closed" : votedOption !== undefined ? "Already voted" : `Vote for ${opt}`}
                                  style={{
                                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                                    padding: "6px 10px", borderRadius: 8, border: isSelected ? "2px solid var(--primary-green)" : "1px solid var(--border-light)",
                                    background: isSelected ? "var(--accent-bg)" : "transparent",
                                    cursor: p.active && votedOption === undefined ? "pointer" : "default",
                                    fontSize: 13, position: "relative", overflow: "hidden",
                                  }}
                                >
                                  <span style={{ fontWeight: 600, fontSize: 12, minWidth: 16 }}>{POLL_OPTION_LABELS[idx]}</span>
                                  <span style={{ flex: 1 }}>{opt}</span>
                                  <span style={{ fontSize: 12, color: "var(--text-light)" }}>{voteCount}/{totalVotes}</span>
                                </button>
                                {totalVotes > 0 && (
                                  <div style={{ height: 4, background: "var(--border-light)", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary-green)", borderRadius: 2 }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11, color: "var(--text-light)" }}>
                            <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}{!p.active ? " · Closed" : ""}</span>
                            {isCreator && p.active && (
                              <button className="btn btn-small" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => closePoll(p.id)}>Close</button>
                            )}
                          </div>
                        </div>
                      );
                    }
                    const msg = entry as ChatMessage;
                    const isMentioned = msg.mentions?.includes(currentUser?.userId || "");
                    return (
                      <div key={msg.id} style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        maxWidth: "80%",
                      }}>
                        <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <strong>{msg.userName}</strong>
                          {isMentioned && <span style={{ background: "#3498db", color: "#fff", fontSize: 10, borderRadius: 8, padding: "0 6px", fontWeight: 600 }}>mentioned</span>}
                          <span>({msg.isTestAccount ? "test acc" : msg.userRole.replace(/_/g, " ")})</span>
                        </div>
                        <div style={{
                          padding: "8px 14px",
                          borderRadius: 16,
                          background: isMentioned ? "var(--accent-bg)" : "var(--bg-secondary)",
                          border: isMentioned ? "1px solid var(--accent-border)" : "1px solid var(--border-light)",
                          fontSize: 14,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}>
                          {renderContent(msg.content)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Poll creation form */}
            {showPollForm && (
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Create a Poll</div>
                <input
                  className="input"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Poll question..."
                  style={{ width: "100%", marginBottom: 6, fontSize: 13 }}
                />
                {pollOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, alignSelf: "center", minWidth: 14, fontWeight: 600 }}>{POLL_OPTION_LABELS[idx]}</span>
                    <input
                      className="input"
                      value={opt}
                      onChange={(e) => updatePollOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    {pollOptions.length > 2 && (
                      <button className="btn btn-small" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => removePollOption(idx)}>x</button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {pollOptions.length < 10 && (
                    <button className="btn btn-small" onClick={addPollOption}>+ Add option</button>
                  )}
                  <button className="btn btn-small btn-primary" onClick={createPoll} disabled={sending || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}>
                    {sending ? "Creating..." : "Create Poll"}
                  </button>
                  <button className="btn btn-small" onClick={() => { setShowPollForm(false); setPollQuestion(""); setPollOptions(["", ""]); }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-light)", padding: "4px 0", fontStyle: "italic" }}>
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* @mention suggestions */}
            {mentionSuggestions.length > 0 && (
              <div style={{
                border: "1px solid var(--border-light)", borderRadius: 8, background: "var(--bg-primary)",
                overflow: "hidden", marginTop: 4,
              }}>
                {mentionSuggestions.map((u, idx) => (
                  <div
                    key={u.userId}
                    onClick={() => insertMention(u.userName)}
                    onMouseEnter={() => setMentionIdx(idx)}
                    style={{
                      padding: "6px 10px", cursor: "pointer", fontSize: 13,
                      background: idx === mentionIdx ? "var(--bg-secondary)" : "transparent",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-green)", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: idx === mentionIdx ? 600 : 400 }}>{u.userName}</span>
                    <span style={{ color: "var(--text-light)", fontSize: 11, marginLeft: "auto" }}>@{u.userName}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Input area */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, borderTop: "1px solid var(--border-light)", paddingTop: 12, alignItems: "flex-end" }}>
              <button
                className="btn btn-small"
                onClick={() => setShowPollForm(!showPollForm)}
                title="Create poll"
                disabled={!connected}
                style={{ fontSize: 18, lineHeight: 1, padding: "6px 8px", alignSelf: "flex-end", marginBottom: 0 }}
              >
                +
              </button>
              <textarea
                ref={inputRef}
                className="input"
                value={input}
                onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart)}
                onKeyDown={handleKeyDown}
                placeholder={connected ? "Type a message... (@ to mention)" : "Connecting..."}
                rows={3}
                disabled={!connected}
                style={{ flex: 1, resize: "none", fontSize: 14, lineHeight: 1.5 }}
              />
              <button className="btn" onClick={sendMessage} disabled={!connected || !input.trim()} style={{ alignSelf: "flex-end" }}>
                Send
              </button>
            </div>
          </div>

          {/* Online users sidebar */}
          {showOnline && isMobile && (
            <div onClick={toggleOnline} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />
          )}
          <div style={{
            width: isMobile ? 220 : 200,
            flexShrink: 0,
            borderLeft: isMobile ? "none" : "1px solid var(--border-light)",
            paddingLeft: isMobile ? 0 : 12,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            ...(isMobile ? {
              display: showOnline ? "flex" : "none",
              position: "fixed",
              top: 0, right: 0, bottom: 0,
              background: "var(--bg-primary)",
              zIndex: 100,
              padding: "1rem",
              borderLeft: "1px solid var(--border-light)",
              boxShadow: "-4px 0 12px rgba(0,0,0,0.15)",
            } : showOnline ? {} : { display: "none" }),
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              Online
              <button onClick={toggleOnline} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-secondary)", padding: 0, lineHeight: 1 }}>x</button>
            </div>
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
