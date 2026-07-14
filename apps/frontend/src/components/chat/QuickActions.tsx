import React from 'react';

const ACTIONS = [
  "SWOT Analysis",
  "Business Strategy",
  "Market Research",
  "Competitor Analysis",
  "Startup Validation",
  "Pricing Strategy"
];

interface QuickActionsProps {
  onActionSelect: (action: string) => void;
}

export default function QuickActions({ onActionSelect }: QuickActionsProps) {
  return (
    <div className="chat-quick-actions">
      {ACTIONS.map((action) => (
        <button
          key={action}
          onClick={() => onActionSelect(`I need help with a ${action}. Can you guide me through the process or ask me relevant questions?`)}
          className="chat-quick-btn"
        >
          {action}
        </button>
      ))}
    </div>
  );
}
