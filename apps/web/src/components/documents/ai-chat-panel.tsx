import { useUIMessages } from "@convex-dev/agent/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import { useMutation } from "convex/react";
import {
  BotIcon,
  LoaderIcon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";

import { Button } from "../ui/button";
import { parseTextWithCitations } from "./citation-chip";
import { useAIProgress } from "./hooks/use-ai-progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIChatPanelProps {
  threadId: string;
  slug: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Message components
// ---------------------------------------------------------------------------

function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [visibleText] = useSmoothText(text, {
    startStreaming: isStreaming,
  });

  return <>{visibleText}</>;
}

function MessageBubble({
  role,
  text,
  status,
  slug,
}: {
  role: string;
  text: string;
  status: string;
  slug: string;
}) {
  const isUser = role === "user";
  const isStreaming = status === "streaming";

  return (
    <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white",
        )}
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <BotIcon className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 font-sans text-sm leading-relaxed",
          isUser
            ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
            : "bg-white text-slate-700 ring-1 ring-slate-200/60 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700/60",
        )}
      >
        {isStreaming ? (
          <StreamingText text={text} isStreaming />
        ) : (
          <span className="whitespace-pre-wrap">{parseTextWithCitations(text, slug)}</span>
        )}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-violet-500/50" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function ProgressIndicator({ threadId }: { threadId: string }) {
  const progress = useAIProgress(threadId);

  if (!progress.isTracking) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2" aria-live="polite" role="status">
      <LoaderIcon className="h-3.5 w-3.5 animate-spin text-violet-500" />
      <span className="font-sans text-xs text-slate-500 dark:text-slate-400">
        {progress.completedTools.length > 0
          ? `Running ${progress.completedTools.at(-1)}...`
          : "Thinking..."}
        {progress.totalSteps && (
          <span className="ml-1 text-slate-400 dark:text-slate-500">
            ({progress.step}/{progress.totalSteps})
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Analyze this document for form fields",
  "What fields does this document need?",
  "Search across my documents for payment terms",
  "Find all documents with a non-compete clause",
];

function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-sans text-xs text-slate-600 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-violet-600 dark:hover:bg-violet-950/30"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main chat panel
// ---------------------------------------------------------------------------

export function AIChatPanel({ threadId, slug, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMessageMutation = useMutation(api.ai.threads.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.ai.threads.listMessages),
  );

  const abortMutation = useMutation(api.ai.threads.abortCurrentStream);

  const { results: messages, status: paginationStatus } = useUIMessages(
    api.ai.threads.listMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  );

  const progress = useAIProgress(threadId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = (text ?? input).trim();
      if (!prompt) return;

      setInput("");

      try {
        await sendMessageMutation({ threadId, prompt });
      } catch {
        setInput(prompt); // Restore input on failure so user doesn't lose their message
        toast.error("Failed to send message");
      }

      // Re-focus input for quick follow-ups
      inputRef.current?.focus();
    },
    [input, sendMessageMutation, threadId],
  );

  const handleAbort = useCallback(async () => {
    try {
      await abortMutation({ threadId });
    } catch {
      toast.error("Failed to stop generation");
    }
  }, [abortMutation, threadId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 text-white">
            <SparklesIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-sans text-sm font-semibold text-slate-800 dark:text-slate-200">
              Seal AI
            </div>
            <div className="font-sans text-[10px] text-slate-500 dark:text-slate-400">
              Document assistant
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          aria-label="Close AI panel"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-label="Chat messages">
        {paginationStatus === "LoadingFirstPage" ? (
          <div className="flex items-center justify-center py-8">
            <LoaderIcon className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30">
              <SparklesIcon className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-center">
              <p className="font-sans text-sm font-medium text-slate-700 dark:text-slate-300">
                How can I help?
              </p>
              <p className="mt-1 font-sans text-xs text-slate-500 dark:text-slate-400">
                I can analyze documents, suggest fields, and search across your workspace
              </p>
            </div>
            <SuggestionChips onSelect={handleSend} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              const text =
                message.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("") ?? "";

              if (!text) return null;

              return (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  text={text}
                  status={message.status}
                  slug={slug}
                />
              );
            })}
            <ProgressIndicator threadId={threadId} />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
        {progress.isTracking ? (
          <div className="flex items-center justify-center" aria-live="polite">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAbort}
              className="h-8 gap-1.5 text-xs text-slate-500 hover:text-red-500"
            >
              <SquareIcon className="h-3 w-3" />
              Stop generating
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this document or search across all..."
              aria-label="Message to AI assistant"
              rows={1}
              className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-sans text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:ring-1 focus:ring-violet-300 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-600 dark:focus:ring-violet-600"
            />
            <Button
              size="sm"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="h-9 w-9 shrink-0 bg-gradient-to-r from-violet-600 to-blue-600 p-0 text-white shadow-sm hover:from-violet-700 hover:to-blue-700 disabled:opacity-40"
              aria-label="Send message"
            >
              <SendIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
