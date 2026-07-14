import { useState, useCallback } from 'react';
import { apiUrl } from '../lib/api';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content;

      if (assistantMessage) {
        setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'An error occurred while fetching the response.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    setMessages,
    setError
  };
}
