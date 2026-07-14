import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../hooks/useChat';
import { Bot, User, Check, Copy } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`chat-message-row ${isAssistant ? 'assistant' : 'user'}`}>
      <div className="chat-message-wrapper">
        {/* Avatar */}
        <div className="chat-message-avatar">
          {isAssistant ? <Bot size={16} /> : <User size={16} />}
        </div>
        
        {/* Message Bubble */}
        <div className="chat-message-bubble">
          {/* Copy Button (only for assistant) */}
          {isAssistant && (
            <button 
              onClick={handleCopy}
              className="chat-message-copy"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="chat-launcher-icon" /> : <Copy size={14} />}
            </button>
          )}

          <div>
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
