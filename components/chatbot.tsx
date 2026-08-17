"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SparkIcon } from "@/components/icons";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STARTER_SUGGESTIONS = [
  "How many active projects do I have?",
  "What payments are pending?",
  "Show my recent deliverables",
  "Give me a workload summary",
];

async function readErrorMessage(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Your session has expired. Please sign in again and try once more.";
  }

  if (response.status === 429) {
    return "You are sending messages too quickly. Please wait a moment and try again.";
  }

  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Fall back to the generic message below.
  }

  return "Something went wrong. Please try again.";
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || isLoading) return;

      setInput("");
      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = { role: "user", content: prompt };
      const conversation = [...messagesRef.current, userMessage];
      setMessages(conversation);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            history: messagesRef.current.slice(-18),
          }),
        });

        if (!response.ok) {
          setMessages(messagesRef.current);
          setError(await readErrorMessage(response));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setMessages(messagesRef.current);
          setError("The response stream could not be read.");
          return;
        }

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });
          setMessages([...conversation, { role: "assistant", content: accumulated }]);
        }

        setMessages([
          ...conversation,
          {
            role: "assistant",
            content:
              accumulated.trim() ||
              "I couldn't find enough information in your ProofVault data to answer that.",
          },
        ]);
      } catch {
        setMessages(messagesRef.current);
        setError("Network error. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chatbot-fab"
          aria-label="Open Taskora AI chat"
          data-tour="taskora-ai-assistant"
          id="chatbot-fab"
        >
          <SparkIcon className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="chatbot-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className="chatbot-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Taskora AI chat"
          >
            <div className="chatbot-header">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wine-950 text-cream-50">
                  <SparkIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-wine-950 tracking-tight">
                    Taskora AI
                  </h3>
                  <p className="text-[11px] text-taupe-500">
                    Ask me anything about your projects.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-taupe-400 transition hover:bg-wine-100 hover:text-wine-950"
                aria-label="Close chat"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="chatbot-messages">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 py-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-wine-100 text-wine-950">
                    <SparkIcon className="h-7 w-7" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-wine-950">
                    Welcome to Taskora AI
                  </p>
                  <p className="mb-5 max-w-[260px] text-center text-xs text-taupe-500">
                    I can help you review projects, payments, deliverables, proof, and activity from your vault.
                  </p>
                  <div className="grid w-full max-w-[280px] gap-2">
                    {STARTER_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => void sendMessage(suggestion)}
                        disabled={isLoading}
                        className="chatbot-suggestion"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 px-4 py-4">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={message.role === "user" ? "chatbot-msg-user" : "chatbot-msg-ai"}
                    >
                      {message.role === "assistant" && (
                        <div className="chatbot-msg-ai-avatar">
                          <SparkIcon className="h-3 w-3" />
                        </div>
                      )}
                      <div
                        className={
                          message.role === "user"
                            ? "chatbot-bubble-user"
                            : "chatbot-bubble-ai"
                        }
                      >
                        {message.content ||
                          (isLoading && index === messages.length - 1 ? <TypingDots /> : null)}
                      </div>
                    </div>
                  ))}

                  {error && (
                    <div className="chatbot-msg-ai">
                      <div className="chatbot-msg-ai-avatar !bg-red-100 !text-red-700">
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                          <path
                            d="M8 4v4M8 11h.01"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <div className="chatbot-bubble-ai !border-red-200 !bg-red-50 text-red-800">
                        {error}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="chatbot-input-area">
              <div className="chatbot-input-wrapper">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your projects..."
                  disabled={isLoading}
                  rows={1}
                  className="chatbot-input"
                  aria-label="Chat message"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="chatbot-send-btn"
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 0 1 8-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
                      <path
                        d="M2 8h12M9 3l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-taupe-400">
                Taskora AI answers from your data only - may make mistakes
              </p>
            </form>
          </div>
        </>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="chatbot-typing" aria-label="Taskora AI is thinking">
      <span className="chatbot-dot" />
      <span className="chatbot-dot" />
      <span className="chatbot-dot" />
    </span>
  );
}
