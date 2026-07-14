import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatWindow from './ChatWindow';
import './chat.css';

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`chat-launcher ${isOpen ? 'hidden' : ''}`}
        aria-label="Open Chat"
      >
        <div className="chat-launcher-ring"></div>
        <MessageSquare size={24} className="chat-launcher-icon" />
      </button>

      <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
