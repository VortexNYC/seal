import { convexMutation } from "../fixtures/convex-test-api";

export async function createDocument(args: {
  organizationSlug: string;
  storageId: string;
  name?: string;
}): Promise<{ id: string; name: string }> {
  const name = args.name ?? `e2e-test-doc-${Date.now()}`;
  const result = (await convexMutation("test_e2e_helpers:createTestDocument", {
    organizationSlug: args.organizationSlug,
    storageId: args.storageId,
    name,
  })) as { status: string; value: { id: string } };

  return { id: result.value.id, name };
}

export async function deleteDocument(documentId: string): Promise<void> {
  await convexMutation("test_e2e_helpers:deleteTestDocument", { documentId });
}
