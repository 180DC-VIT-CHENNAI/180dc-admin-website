import { useRef, useEffect } from 'react';
import { X, RefreshCcw, Trash2 } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import QuickActions from './QuickActions';
import { useChat } from '../../hooks/useChat';

interface ChatWindowProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function ChatWindow({ onClose, isOpen }: ChatWindowProps) {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, error]);

  if (!isOpen) return null;

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar-container">
            <span className="chat-avatar-icon">🤖</span>
            <div className="chat-online-indicator"></div>
          </div>
          <div>
            <h3 className="chat-title">ConsultAI</h3>
            <p className="chat-subtitle">Business Consulting Assistant</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {messages.length > 0 && (
            <button 
              onClick={clearChat}
              className="chat-close-btn"
              title="Clear Chat"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="chat-close-btn"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-body">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <h4 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Welcome to 180 Degrees Consulting VIT Chennai.</h4>
            <p style={{ lineHeight: '1.6', marginBottom: '16px', color: '#e5e7eb' }}>
              I am ConsultAI, your dedicated advisory assistant. We specialize in providing high-impact, pro-bono consulting to socially conscious organizations.
            </p>
            <p style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
              Core Competencies:
            </p>
            <ul style={{ lineHeight: '1.8', marginBottom: '20px' }}>
              <li>• Business & Growth Strategy</li>
              <li>• Market Research & Expansion</li>
              <li>• Competitor & SWOT Analysis</li>
              <li>• 180DC Information & Operations</li>
            </ul>
            <p style={{ fontStyle: 'italic', color: '#9ca3af' }}>How may I provide value to you today?</p>
            <QuickActions onActionSelect={sendMessage} />
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
        
        {isLoading && <TypingIndicator />}
        
        {error && (
          <div className="chat-error">
            <p>{error}</p>
            <button 
              onClick={() => sendMessage(messages[messages.length - 1]?.content || '')}
              className="chat-retry-btn"
            >
              <RefreshCcw size={12} /> Retry
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
