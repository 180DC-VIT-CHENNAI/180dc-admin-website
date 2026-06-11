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
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
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

  async function loadOlderMessages() {
    if (loadingOlder || entries.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = entries.reduce((min, e) => Math.min(min, e.timestamp), Infinity);
      const res = await fetch(apiUrl(`/api/chat/archive?room=${encodeURIComponent(room)}&before=${oldest}&limit=50`), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.messages?.length) {
        setEntries((prev) => [...data.messages, ...prev]);
        if (data.messages.length < 50) setAllLoaded(true);
      } else {
        setAllLoaded(true);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOlder(false);
    }
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
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
      {/* Error Banner */}
      {error && (
        <div style={{ padding: "0.75rem 1.5rem", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: 13, fontWeight: 600, borderBottom: "1px solid rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          {error}
        </div>
      )}
      
      {/* Header */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-bg)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined">forum</span>
          </div>
          <div>
             <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{roomName}</h3>
             <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: connected ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                {connected ? `${onlineUsers.length} active now` : "Offline"}
             </div>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={toggleOnline} className="header-action-btn" title="Toggle Sidebar">
            <span className="material-symbols-outlined">{showOnline ? "side_navigation" : "dock_to_left"}</span>
          </button>
          <button onClick={reconnect} className="header-action-btn" title="Reconnect">
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Messages area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface-container-low)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {entries.length > 0 && !allLoaded && (
              <button onClick={loadOlderMessages} disabled={loadingOlder} className="btn outline" style={{ margin: "0 auto 1rem", fontSize: 12, padding: "4px 12px", borderRadius: 20 }}>
                {loadingOlder ? "Loading..." : "Load Older Messages"}
              </button>
            )}

            {grouped.map((group) => (
              <div key={group.dateLabel} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "1rem 0" }}>
                   <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                   <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{group.dateLabel}</span>
                   <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
                </div>

                {group.entries.map((entry) => {
                  if (isPoll(entry)) {
                    const p = entry.poll;
                    const votedOption = p.votes[currentUser?.userId || ""];
                    const totalVotes = Object.keys(p.votes).length;
                    const isCreator = currentUser?.userId === p.creatorId;
                    return (
                      <div key={entry.id} style={{ maxWidth: "400px", margin: "0 auto", width: "100%", padding: "1.5rem", borderRadius: 20, background: "var(--bg-card)", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
                           <span className="material-symbols-outlined" style={{ color: "var(--primary-green)", fontSize: 20 }}>poll</span>
                           <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Poll by <strong>{p.creatorName}</strong></span>
                        </div>
                        <h4 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>{p.question}</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {p.options.map((opt, idx) => {
                            const voteCount = Object.values(p.votes).filter((v) => v === idx).length;
                            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                            const isSelected = votedOption === idx;
                            return (
                              <div key={idx}>
                                <button
                                  onClick={() => p.active && votedOption === undefined ? vote(p.id, idx) : null}
                                  disabled={!p.active || (votedOption !== undefined && !isSelected)}
                                  style={{
                                    width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10,
                                    border: `1px solid ${isSelected ? "var(--primary-green)" : "var(--border-light)"}`,
                                    background: isSelected ? "var(--accent-bg)" : "var(--bg-card)",
                                    cursor: p.active && votedOption === undefined ? "pointer" : "default",
                                    display: "flex", justifyContent: "space-between", alignItems: "center"
                                  }}
                                >
                                  <span style={{ fontSize: 14, fontWeight: 500 }}>{opt}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "var(--primary-green)" : "var(--text-tertiary)" }}>{pct}%</span>
                                </button>
                                <div style={{ height: 4, background: "var(--surface-variant)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                                   <div style={{ width: `${pct}%`, height: "100%", background: isSelected ? "var(--primary-green)" : "var(--text-tertiary)", transition: "width 0.5s ease" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                           <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{totalVotes} total votes {!p.active && "• Closed"}</span>
                           {isCreator && p.active && <button className="btn outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => closePoll(p.id)}>Close Poll</button>}
                        </div>
                      </div>
                    );
                  }

                  const msg = entry as ChatMessage;
                  const isMe = msg.userId === currentUser?.userId;
                  const isMentioned = msg.mentions?.includes(currentUser?.userId || "");
                  
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4, marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          {msg.userName}
                          {msg.isTestAccount && <span style={{ fontSize: 9, background: "var(--surface-container-high)", padding: "1px 4px", borderRadius: 4 }}>TEST</span>}
                        </div>
                      )}
                      <div style={{
                        padding: "10px 14px", borderRadius: 18,
                        borderBottomLeftRadius: !isMe ? 4 : 18,
                        borderBottomRightRadius: isMe ? 4 : 18,
                        background: isMe ? "var(--primary-green)" : isMentioned ? "var(--accent-bg)" : "var(--bg-card)",
                        color: isMe ? "white" : "var(--text-primary)",
                        border: isMentioned ? "1px solid var(--accent)" : isMe ? "none" : "1px solid var(--border-light)",
                        maxWidth: "80%", fontSize: 14, lineHeight: 1.5, boxShadow: "var(--shadow-sm)",
                        position: "relative"
                      }}>
                        {renderContent(msg.content)}
                        <div style={{ fontSize: 9, marginTop: 4, textAlign: "right", opacity: 0.7 }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "1.25rem 1.5rem", background: "var(--bg-card)", borderTop: "1px solid var(--border-light)" }}>
            {typingNames.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
              </div>
            )}
            
            {showPollForm && (
              <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: 16, background: "var(--surface-container-low)", border: "1px solid var(--border-light)" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>New Poll</h4>
                <input className="input" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="What's your question?" style={{ marginBottom: 8 }} />
                {pollOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <input className="input" value={opt} onChange={(e) => updatePollOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} />
                    {pollOptions.length > 2 && <button onClick={() => removePollOption(idx)} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}><span className="material-symbols-outlined">delete</span></button>}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="btn outline" onClick={addPollOption} style={{ fontSize: 12, padding: "6px 12px" }}>+ Add Option</button>
                  <button className="btn" onClick={createPoll} disabled={sending || !pollQuestion.trim()} style={{ fontSize: 12, padding: "6px 12px", marginLeft: "auto" }}>Create Poll</button>
                  <button className="btn outline" onClick={() => setShowPollForm(false)} style={{ fontSize: 12, padding: "6px 12px" }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <button className="header-action-btn" onClick={() => setShowPollForm(true)} disabled={!connected} style={{ marginBottom: 4 }}>
                <span className="material-symbols-outlined">add_chart</span>
              </button>
              
              <div style={{ flex: 1, position: "relative" }}>
                 {mentionSuggestions.length > 0 && (
                   <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12, boxShadow: "var(--shadow-lg)", marginBottom: 8, overflow: "hidden" }}>
                     {mentionSuggestions.map((u, idx) => (
                       <div key={u.userId} onClick={() => insertMention(u.userName)} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, background: idx === mentionIdx ? "var(--surface-variant)" : "transparent", display: "flex", alignItems: "center", gap: 10 }}>
                         <div className="avatar-circle" style={{ width: 24, height: 24, fontSize: 10 }}>{u.userName[0]}</div>
                         <span>{u.userName}</span>
                       </div>
                     ))}
                   </div>
                 )}
                 <textarea
                   ref={inputRef}
                   className="input"
                   value={input}
                   onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart)}
                   onKeyDown={handleKeyDown}
                   placeholder="Type your message..."
                   rows={1}
                   style={{ resize: "none", padding: "12px 16px", borderRadius: 24, minHeight: 46, maxHeight: 150 }}
                 />
              </div>
              
              <button className="btn" onClick={sendMessage} disabled={!connected || !input.trim()} style={{ borderRadius: "50%", width: 46, height: 46, padding: 0, justifyContent: "center", marginBottom: 0 }}>
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {showOnline && (
          <div style={{ width: isMobile ? "100%" : "280px", borderLeft: "1px solid var(--border-light)", background: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-light)", fontWeight: 700, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Members
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {onlineUsers.map((u) => (
                  <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 12, transition: "background 0.2s" }}>
                    <div style={{ position: "relative" }}>
                      <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: 14 }}>{u.userName[0]}</div>
                      <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#10b981", border: "2px solid var(--bg-card)" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.userName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>{u.userRole.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                ))}
                {onlineUsers.length === 0 && <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, marginTop: "2rem" }}>No active users.</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
