import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useState } from "react";

type RecipientToRemove = {
  id: Id<"document_recipients">;
  publicId: string;
  email: string;
  name?: string;
  role: string;
  fieldCount: number;
} | null;

type RecipientForOptions = {
  _id: Id<"document_recipients">;
  publicId: string;
  email: string;
  name?: string;
  role: "signer" | "viewer" | "approver";
  status: "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";
  signingToken?: string;
} | null;

/**
 * Groups dialog open/close state for the document detail page.
 * Does not contain any business logic — only state values and setters.
 */
export function useDocumentState(initialRedirectUrl: string) {
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);
  const [addMyselfOpen, setAddMyselfOpen] = useState(false);
  const [removeRecipientOpen, setRemoveRecipientOpen] = useState(false);
  const [recipientToRemove, setRecipientToRemove] =
    useState<RecipientToRemove>(null);
  const [recipientOptionsOpen, setRecipientOptionsOpen] = useState(false);
  const [selectedRecipientForOptions, setSelectedRecipientForOptions] =
    useState<RecipientForOptions>(null);
  const [sendDocumentOpen, setSendDocumentOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [redirectUrlInput, setRedirectUrlInput] = useState(initialRedirectUrl);
  const [redirectUrlError, setRedirectUrlError] = useState<string | null>(null);
  const [isSavingRedirect, setIsSavingRedirect] = useState(false);

  return {
    addRecipientOpen,
    setAddRecipientOpen,
    addMyselfOpen,
    setAddMyselfOpen,
    removeRecipientOpen,
    setRemoveRecipientOpen,
    recipientToRemove,
    setRecipientToRemove,
    recipientOptionsOpen,
    setRecipientOptionsOpen,
    selectedRecipientForOptions,
    setSelectedRecipientForOptions,
    sendDocumentOpen,
    setSendDocumentOpen,
    saveAsTemplateOpen,
    setSaveAsTemplateOpen,
    redirectUrlInput,
    setRedirectUrlInput,
    redirectUrlError,
    setRedirectUrlError,
    isSavingRedirect,
    setIsSavingRedirect,
  };
}
