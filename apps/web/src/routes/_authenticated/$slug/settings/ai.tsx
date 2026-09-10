/**
 * AI Settings Page
 *
 * Organization AI feature controls (admin-only mutations, visible to all members)
 * Route: /{slug}/settings/ai
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BotIcon, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getAiSettings, getOrganization, updateAiSettings } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/$slug/settings/ai")({
  component: AISettings,
  pendingComponent: FormSkeleton,
});

function AISettings() {
  const { slug } = Route.useParams();

  const { data: organization } = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => getOrganization(slug),
  });

  const { data: aiSettings } = useQuery({
    queryKey: ["ai", slug],
    queryFn: () => getAiSettings(slug),
    enabled: !!organization,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    aiEnabled: true,
    aiAutoAnalyze: true,
    aiShowRedlinesToSigners: false,
  });

  useEffect(() => {
    if (aiSettings) {
      setFormData({
        aiEnabled: aiSettings.aiEnabled,
        aiAutoAnalyze: aiSettings.aiAutoAnalyze,
        aiShowRedlinesToSigners: aiSettings.aiShowRedlinesToSigners,
      });
    }
  }, [aiSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateAiSettings(slug, {
        aiEnabled: formData.aiEnabled,
        aiAutoAnalyze: formData.aiAutoAnalyze,
        aiShowRedlinesToSigners: formData.aiShowRedlinesToSigners,
      });
      toast.success("AI settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update AI settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !aiSettings) {
    return null;
  }

  return (
    <PageWrapper title="AI Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BotIcon className="h-5 w-5" />
              <CardTitle>Document Intelligence</CardTitle>
            </div>
            <CardDescription>
              Control how Seal AI analyzes documents, detects fields, and
              surfaces insights for your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="ai-enabled" className="text-sm font-medium">
                  Enable AI features
                </Label>
                <p className="text-muted-foreground text-xs">
                  Turn off to hide all AI suggestions, annotations, and chat
                  across your workspace.
                </p>
              </div>
              <Switch
                id="ai-enabled"
                checked={formData.aiEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, aiEnabled: checked })
                }
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="ai-auto-analyze"
                    className="text-sm font-medium"
                  >
                    Auto-analyze uploaded documents
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Automatically detect form fields and surface insights when
                    documents are uploaded. Disable to require manual analysis.
                  </p>
                </div>
                <Switch
                  id="ai-auto-analyze"
                  checked={formData.aiAutoAnalyze}
                  disabled={!formData.aiEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, aiAutoAnalyze: checked })
                  }
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="ai-redlines-signers"
                    className="text-sm font-medium"
                  >
                    Show insights to signers
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    When enabled, document signers will see AI-generated
                    annotations (obligations, risks, payment terms) on the
                    signing page.
                  </p>
                </div>
                <Switch
                  id="ai-redlines-signers"
                  checked={formData.aiShowRedlinesToSigners}
                  disabled={!formData.aiEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      aiShowRedlinesToSigners: checked,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
