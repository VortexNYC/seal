/**
 * AI Settings Page
 *
 * Organization AI feature controls (admin-only mutations, visible to all members)
 * Route: /{slug}/settings/ai
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Text } from "@cloudflare/kumo/components/text";
import { FloppyDisk, Robot } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getAiSettings, updateAiSettings } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/$slug/settings/ai")({
  component: AISettings,
  pendingComponent: FormSkeleton,
});

function AISettings() {
  const { slug } = Route.useParams();

  const { data: aiSettings } = useQuery({
    queryKey: ["ai", slug],
    queryFn: () => getAiSettings(slug),
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

  if (!aiSettings) {
    return null;
  }

  return (
    <PageWrapper title="AI Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <Robot className="h-5 w-5" />
              <Text as="h2" variant="heading">
                Document Intelligence
              </Text>
            </div>
            <Text variant="secondary">
              Control how Seal AI analyzes documents, detects fields, and
              surfaces insights for your workspace.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="ai-enabled" className="text-sm font-medium">
                    Enable AI features
                  </Label>
                  <Text variant="secondary" as="p">
                    Turn off to hide all AI suggestions, annotations, and chat
                    across your workspace.
                  </Text>
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
                    <Text variant="secondary" as="p">
                      Automatically detect form fields and surface insights when
                      documents are uploaded. Disable to require manual
                      analysis.
                    </Text>
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
                    <Text variant="secondary" as="p">
                      When enabled, document signers will see AI-generated
                      annotations (obligations, risks, payment terms) on the
                      signing page.
                    </Text>
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
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
