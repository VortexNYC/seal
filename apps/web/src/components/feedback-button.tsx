import { api } from "@seal/backend/convex/_generated/api";
import { useLocation } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Bug, Lightbulb, MessageSquare, X } from "lucide-react";
import { useState } from "react";

import { startJamRecording } from "@/lib/jam";

import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Textarea } from "./ui/textarea";

type Mode = "idle" | "suggestion";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitFeedback = useMutation(api.feedback.mutations.submit);
  const location = useLocation();

  function handleReportBug() {
    setOpen(false);
    setMode("idle");
    startJamRecording();
  }

  async function handleSubmitSuggestion() {
    if (!message.trim()) return;
    await submitFeedback({
      type: "suggestion",
      message: message.trim(),
      route: location.pathname,
    });
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage("");
      setMode("idle");
    }, 1500);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode("idle");
      setMessage("");
      setSubmitted(false);
    }
  }

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 shadow-md" aria-label="Feedback">
            <MessageSquare className="size-4" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end" side="top" sideOffset={8}>
          {submitted ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              Thanks for the suggestion!
            </p>
          ) : mode === "suggestion" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Make a suggestion</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0"
                  onClick={() => setMode("idle")}
                >
                  <X className="size-3" />
                </Button>
              </div>
              <Textarea
                placeholder="Describe your idea..."
                className="resize-none text-sm"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!message.trim()}
                onClick={() => void handleSubmitSuggestion()}
              >
                Submit
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-muted-foreground mb-2 text-xs">How can we improve?</p>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors"
                onClick={handleReportBug}
              >
                <Bug className="text-destructive size-4 shrink-0" />
                <span>Report a bug</span>
              </button>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors"
                onClick={() => setMode("suggestion")}
              >
                <Lightbulb className="size-4 shrink-0 text-yellow-500" />
                <span>Make a suggestion</span>
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
