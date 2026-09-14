import { Button } from "@cloudflare/kumo/components/button";
import { Textarea } from "@cloudflare/kumo/components/input";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Text } from "@cloudflare/kumo/components/text";
import { Bug, ChatTeardropText, Lightbulb, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useState } from "react";

import { submitFeedback } from "@/lib/api-client";
import { startJamRecording } from "@/lib/jam";

type Mode = "idle" | "suggestion";

export function FeedbackButton({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitFeedbackMutation = useMutation({
    mutationFn: (input: Parameters<typeof submitFeedback>[1]) =>
      submitFeedback(organizationSlug, input),
  });
  const location = useLocation();

  function handleReportBug() {
    setOpen(false);
    setMode("idle");
    startJamRecording();
  }

  async function handleSubmitSuggestion() {
    if (!message.trim()) return;
    await submitFeedbackMutation.mutateAsync({
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
        <Popover.Trigger
          render={
            <Button
              variant="outline"
              size="sm"
              icon={ChatTeardropText}
              className="shadow-md"
            >
              Feedback
            </Button>
          }
        />
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="w-64 p-3"
        >
          {submitted ? (
            <div className="py-2 text-center">
              <Text as="p" size="sm" variant="secondary">
                Thanks for the suggestion!
              </Text>
            </div>
          ) : mode === "suggestion" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Text as="span" size="sm" variant="body">
                  Make a suggestion
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  shape="square"
                  icon={X}
                  aria-label="Back to feedback options"
                  onClick={() => setMode("idle")}
                />
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
              <div className="mb-2">
                <Text as="p" size="xs" variant="secondary">
                  How can we improve?
                </Text>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                icon={<Bug className="text-kumo-danger size-4 shrink-0" />}
                onClick={handleReportBug}
              >
                Report a bug
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                icon={
                  <Lightbulb className="text-kumo-warning size-4 shrink-0" />
                }
                onClick={() => setMode("suggestion")}
              >
                Make a suggestion
              </Button>
            </div>
          )}
        </Popover.Content>
      </Popover>
    </div>
  );
}
