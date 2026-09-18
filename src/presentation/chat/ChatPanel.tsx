import { useState } from "react";
import type { KeyboardEvent } from "react";
import "./ChatPanel.css";

/**
 * Presentation-local for now, not Domain — same precedent as t18's
 * RoomDimensions/ThemeSelection, which only moved to Domain once
 * Application actually needed them. Promote this the same way if t26/t27
 * ever do.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");

  function send() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") send();
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="chat-panel-empty">Ask me to swap a fixture, change your budget, or explain a choice.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-message chat-message-${m.role}`}>
              {m.text}
            </div>
          ))
        )}
      </div>
      <div className="chat-panel-input-row">
        <input
          type="text"
          aria-label="Message"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={send} disabled={!draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
