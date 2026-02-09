'use client';

import { useState } from 'react';
import { Send, Loader2, MessageSquare } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface DocumentChatProps {
    documentId: string;
}

export default function DocumentChat({ documentId }: DocumentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId,
                    message: userMessage.content
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get response');
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.answer,
                timestamp: data.timestamp
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            const errorMessage: Message = {
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="document-chat">
            <div className="chat-header">
                <MessageSquare size={20} />
                <h3>Ask about this document</h3>
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        <MessageSquare size={48} />
                        <p>Ask me anything about this document!</p>
                        <div className="suggestions">
                            <button onClick={() => setInput("What is the total amount?")}>
                                What is the total amount?
                            </button>
                            <button onClick={() => setInput("Who is the vendor?")}>
                                Who is the vendor?
                            </button>
                            <button onClick={() => setInput("When is the due date?")}>
                                When is the due date?
                            </button>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            <div className="message-content">{msg.content}</div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="message assistant loading">
                        <Loader2 className="spinning" size={16} />
                        <span>Thinking...</span>
                    </div>
                )}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="send-button"
                >
                    <Send size={18} />
                </button>
            </div>

            <style jsx>{`
                .document-chat {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: flex;
                    flex-direction: column;
                    height: 600px;
                    overflow: hidden;
                }

                .chat-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 2px solid #e2e8f0;
                }

                .chat-header h3 {
                    margin: 0;
                    font-size: 1.125rem;
                    color: #2d3748;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .chat-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #718096;
                    text-align: center;
                }

                .chat-empty svg {
                    color: #cbd5e0;
                    margin-bottom: 1rem;
                }

                .suggestions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 1rem;
                }

                .suggestions button {
                    padding: 0.75rem 1rem;
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 0.875rem;
                    color: #4a5568;
                }

                .suggestions button:hover {
                    background: #edf2f7;
                    border-color: #cbd5e0;
                }

                .message {
                    display: flex;
                    margin-bottom: 0.75rem;
                    animation: slideIn 0.3s ease-out;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .message.user {
                    justify-content: flex-end;
                }

                .message.assistant {
                    justify-content: flex-start;
                }

                .message-content {
                    max-width: 80%;
                    padding: 0.875rem 1.125rem;
                    border-radius: 12px;
                    line-height: 1.5;
                }

                .message.user .message-content {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .message.assistant .message-content {
                    background: #f7fafc;
                    color: #2d3748;
                    border-bottom-left-radius: 4px;
                }

                .message.loading {
                    align-items: center;
                    gap: 0.5rem;
                    color: #718096;
                    font-size: 0.875rem;
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .chat-input {
                    display: flex;
                    gap: 0.75rem;
                    padding: 1.25rem 1.5rem;
                    border-top: 2px solid #e2e8f0;
                    background: #f7fafc;
                }

                .chat-input input {
                    flex: 1;
                    padding: 0.875rem 1.125rem;
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.9375rem;
                    outline: none;
                    transition: border-color 0.2s;
                }

                .chat-input input:focus {
                    border-color: #667eea;
                }

                .chat-input input:disabled {
                    background: #edf2f7;
                    cursor: not-allowed;
                }

                .send-button {
                    padding: 0.875rem 1.125rem;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.1s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .send-button:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }

                .send-button:active:not(:disabled) {
                    transform: translateY(0);
                }

                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}
