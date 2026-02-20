/**
 * Dedicated search page with conversational AI search.
 *
 * Uses the Seal AI agent with the searchDocuments tool to provide
 * cross-document search with citation chips and streaming responses.
 */

import { useUIMessages } from "@convex-dev/agent/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { BotIcon, SearchIcon, SendIcon, UserIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { parseTextWithCitations } from "@/components/search/citation-chip";
import { SearchFiltersBar, type SearchFilters } from "@/components/search/search-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/search")({
  component: SearchPage,
});

// ---------------------------------------------------------------------------
// Message components
// ---------------------------------------------------------------------------

function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [visibleText] = useSmoothText(text, { startStreaming: isStreaming });
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
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <BotIcon className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
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
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-500/50" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search page
// ---------------------------------------------------------------------------

function SearchPage() {
  const { slug } = Route.useParams();
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [_filters, setFilters] = useState<SearchFilters>({
    workflowStatus: "all",
    dateFrom: "",
    dateTo: "",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Thread management
  const createSearchThread = useMutation(api.ai.threads.getOrCreateSearchThread);
  const sendMessageMutation = useMutation(api.ai.threads.sendMessage).withOptimisticUpdate(
    optimisticallySendMessage(api.ai.threads.listMessages),
  );

  // Messages (only load when we have a thread)
  const { results: messages } = useUIMessages(
    threadId ? api.ai.threads.listMessages : ("skip" as never),
    threadId ? { threadId } : ("skip" as never),
    { initialNumItems: 50, stream: true },
  );

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const query = (text ?? input).trim();
      if (!query) return;

      setInput("");

      try {
        // Get or create a search thread
        let currentThreadId = threadId;
        if (!currentThreadId) {
          const result = await createSearchThread({});
          currentThreadId = result.threadId;
          setThreadId(currentThreadId);
        }

        await sendMessageMutation({ threadId: currentThreadId, prompt: query });
      } catch {
        toast.error("Failed to send message");
      }
    },
    [input, threadId, createSearchThread, sendMessageMutation],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasMessages = messages && messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Search Documents</h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about your documents — Seal AI will search and cite sources
            </p>
          </div>
        </div>
        {/* Filter bar */}
        <div className="mt-3">
          <SearchFiltersBar filters={_filters} onChange={setFilters} />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white">
              <SearchIcon className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Search across your documents</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ask about specific clauses, payment terms, dates, signers, or anything else. Seal AI
                will search all your documents and cite its sources.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "What are the payment terms across my contracts?",
                "Find all documents with a non-compete clause",
                "Which documents mention a deadline in March?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-600 dark:hover:text-violet-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.map((message) => {
              const text =
                message.parts
                  ?.filter(
                    (p): p is { type: "text"; text: string } => "type" in p && p.type === "text",
                  )
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents..."
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-600 dark:focus:ring-violet-600"
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
      </div>
    </div>
  );
}
