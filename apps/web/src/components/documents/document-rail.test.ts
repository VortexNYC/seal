import { describe, expect, it, vi } from "vitest";

import {
  FINISH_FIELD_MESSAGE,
  activeRailPanel,
  allowFieldDelete,
  asOptionsFieldType,
  canLeaveFieldSetup,
  fieldOptionsPanelReady,
  fieldTypeNeedsOptions,
  finishPaymentSave,
  countSigningFields,
  isSigningFieldType,
  isFieldSetupOpen,
  nextPlacementSignerId,
  placementFieldChooser,
  provisionalPaymentToDelete,
  railStepFor,
  resolvePagePlaceIntent,
  resolvePlaceFieldsIntent,
  resolveSendIntent,
  sendDocumentReadiness,
  signerForPlacement,
  signerRecipients,
} from "./document-rail";

const idlePanel = {
  removeRecipient: false,
  recipientOptions: false,
  deleteField: false,
  fieldOptions: false,
  payment: false,
  fieldProperties: false,
  send: false,
  saveTemplate: false,
  addMyself: false,
  addRecipient: false,
};

describe("field setup", () => {
  it("stays open for option fields and a new unpaid payment field", () => {
    expect(
      isFieldSetupOpen({
        showFieldOptions: true,
        provisionalPaymentFieldPublicId: null,
      })
    ).toBe(true);
    expect(
      isFieldSetupOpen({
        showFieldOptions: false,
        provisionalPaymentFieldPublicId: "fld_pay",
      })
    ).toBe(true);
    expect(
      isFieldSetupOpen({
        showFieldOptions: false,
        provisionalPaymentFieldPublicId: null,
      })
    ).toBe(false);
  });

  it("refuses to leave while setup is open", () => {
    expect(canLeaveFieldSetup(true)).toBe(false);
    expect(canLeaveFieldSetup(false)).toBe(true);
    expect(FINISH_FIELD_MESSAGE).toBe("Finish this field, or use Back.");
  });

  it("treats checkbox, dropdown, radio, and multi-select as option fields", () => {
    expect(fieldTypeNeedsOptions("checkbox")).toBe(true);
    expect(fieldTypeNeedsOptions("dropdown")).toBe(true);
    expect(fieldTypeNeedsOptions("radio")).toBe(true);
    expect(fieldTypeNeedsOptions("multi_select")).toBe(true);
    expect(fieldTypeNeedsOptions("signature")).toBe(false);
    expect(fieldTypeNeedsOptions("payment")).toBe(false);
    expect(asOptionsFieldType("text")).toBeNull();
  });

  it("does not open the options panel without a supported pending field", () => {
    expect(fieldOptionsPanelReady(true, "checkbox")).toBe(true);
    expect(fieldOptionsPanelReady(true, "signature")).toBe(false);
    expect(fieldOptionsPanelReady(true, null)).toBe(false);
    expect(fieldOptionsPanelReady(false, "radio")).toBe(false);
  });

  it("ignores delete while a field form is open", () => {
    const closed = {
      showFieldOptions: false,
      showPaymentConfigModal: false,
      showFieldProperties: false,
      provisionalPaymentFieldPublicId: null,
    };
    expect(allowFieldDelete(closed)).toBe(true);
    expect(allowFieldDelete({ ...closed, showFieldOptions: true })).toBe(false);
    expect(allowFieldDelete({ ...closed, showPaymentConfigModal: true })).toBe(
      false
    );
    expect(allowFieldDelete({ ...closed, showFieldProperties: true })).toBe(
      false
    );
    expect(
      allowFieldDelete({
        ...closed,
        provisionalPaymentFieldPublicId: "fld_pay",
      })
    ).toBe(false);
  });
});

describe("payment field that is not saved yet", () => {
  it("deletes the field when Back is used before save", () => {
    expect(
      provisionalPaymentToDelete({
        provisionalFieldPublicId: "fld_pay",
        committed: false,
      })
    ).toBe("fld_pay");
  });

  it("keeps the field after a successful save", () => {
    expect(
      provisionalPaymentToDelete({
        provisionalFieldPublicId: "fld_pay",
        committed: true,
      })
    ).toBeNull();
  });

  it("keeps a payment field that was already on the document", () => {
    expect(
      provisionalPaymentToDelete({
        provisionalFieldPublicId: null,
        committed: false,
      })
    ).toBeNull();
  });

  it("marks the field saved before the panel closes", () => {
    const order: string[] = [];
    finishPaymentSave({
      onSaved: () => {
        order.push("saved");
      },
      onOpenChange: () => {
        order.push("closed");
      },
    });
    expect(order).toEqual(["saved", "closed"]);
  });

  it("still closes when there is no save callback", () => {
    const onOpenChange = vi.fn();
    finishPaymentSave({ onOpenChange });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("who fields are placed for", () => {
  const people = [
    { _id: "a", role: "approver", email: "a@ex.com", name: "Ada" },
    { _id: "s1", role: "signer", email: "s1@ex.com", name: "Sam" },
    { _id: "v", role: "viewer", email: "v@ex.com", name: null },
    { _id: "s2", role: "signer", email: "s2@ex.com", name: "Sue" },
  ];

  it("ignores approvers and viewers", () => {
    expect(signerRecipients(people).map((person) => person._id)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("hides the chooser for no signers, names the only signer, and selects among several", () => {
    expect(placementFieldChooser(0)).toBe("hidden");
    expect(placementFieldChooser(1)).toBe("named");
    expect(placementFieldChooser(2)).toBe("select");
  });

  it("uses the chosen signer, then the first signer, then nobody", () => {
    const signers = signerRecipients(people);
    expect(signerForPlacement(signers, "s2")?._id).toBe("s2");
    expect(signerForPlacement(signers, "missing")?._id).toBe("s1");
    expect(signerForPlacement(signers, null)?._id).toBe("s1");
    expect(signerForPlacement([], "s1")).toBeNull();
  });

  it("clears a signer who was removed and defaults to the first signer", () => {
    expect(nextPlacementSignerId(people, "s2")).toBe("s2");
    expect(nextPlacementSignerId(people, "gone")).toBe("s1");
    expect(nextPlacementSignerId(people, null)).toBe("s1");
    expect(
      nextPlacementSignerId(
        [{ _id: "a", role: "approver", email: "a@ex.com" }],
        "a"
      )
    ).toBeNull();
  });
});

describe("rail panel priority", () => {
  it("shows nothing when every panel is closed", () => {
    expect(activeRailPanel(idlePanel)).toBeNull();
    expect(railStepFor(null)).toBeUndefined();
  });

  it("keeps an unfinished field above a request to add someone", () => {
    expect(
      activeRailPanel({
        ...idlePanel,
        fieldOptions: true,
        addRecipient: true,
      })
    ).toBe("field-options");
  });

  it("keeps remove above the recipient menu", () => {
    expect(
      activeRailPanel({
        ...idlePanel,
        removeRecipient: true,
        recipientOptions: true,
      })
    ).toBe("remove-recipient");
  });

  it("keeps delete above payment setup", () => {
    expect(
      activeRailPanel({ ...idlePanel, deleteField: true, payment: true })
    ).toBe("delete-field");
  });

  it("keeps payment above field settings", () => {
    expect(
      activeRailPanel({
        ...idlePanel,
        payment: true,
        fieldProperties: true,
      })
    ).toBe("payment");
  });

  it("does not change the People / Fields / Send step for save as template", () => {
    expect(activeRailPanel({ ...idlePanel, saveTemplate: true })).toBe(
      "save-template"
    );
    expect(railStepFor("save-template")).toBeUndefined();
  });

  it("points People, Fields, and Send at the panel that replaced them", () => {
    expect(railStepFor("add-recipient")).toBe(1);
    expect(railStepFor("add-myself")).toBe(1);
    expect(railStepFor("recipient-options")).toBe(1);
    expect(railStepFor("field-options")).toBe(2);
    expect(railStepFor("payment")).toBe(2);
    expect(railStepFor("field-properties")).toBe(2);
    expect(railStepFor("delete-field")).toBe(2);
    expect(railStepFor("send")).toBe(3);
  });
});

describe("Send", () => {
  it("stays on an unfinished field even when the document could be sent", () => {
    expect(
      resolveSendIntent({
        fieldSetupOpen: true,
        canSend: true,
        canEdit: true,
        signerCount: 1,
      })
    ).toEqual({ kind: "finish-field" });
  });

  it("opens the send form when the document is ready", () => {
    expect(
      resolveSendIntent({
        fieldSetupOpen: false,
        canSend: true,
        canEdit: true,
        signerCount: 1,
      })
    ).toEqual({ kind: "open-send" });
  });

  it("opens add recipient, without a toast, when a draft has no signer", () => {
    expect(
      resolveSendIntent({
        fieldSetupOpen: false,
        canSend: false,
        canEdit: true,
        signerCount: 0,
        blockedReason: "Add a recipient before sending.",
      })
    ).toEqual({ kind: "open-add-recipient" });
  });

  it("explains a missing field and opens Fields when signers are already on the document", () => {
    expect(
      resolveSendIntent({
        fieldSetupOpen: false,
        canSend: false,
        canEdit: true,
        signerCount: 2,
        blockedReason: "The following signers need at least one signature field: Sam",
      })
    ).toEqual({
      kind: "blocked",
      message: "The following signers need at least one signature field: Sam",
      openFields: true,
    });
  });

  it("only explains when the document can no longer be edited", () => {
    expect(
      resolveSendIntent({
        fieldSetupOpen: false,
        canSend: false,
        canEdit: false,
        signerCount: 0,
        blockedReason: "Only a draft can be sent.",
      })
    ).toEqual({
      kind: "blocked",
      message: "Only a draft can be sent.",
      openFields: false,
    });
  });
});

describe("send readiness", () => {
  const signer = {
    _id: "s1",
    role: "signer",
    email: "s@ex.com",
    name: "Sam",
  };

  it("sends a draft whose signer has a signature", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [signer],
        fields: [{ recipientId: "s1", fieldType: "signature" }],
      }).canSend
    ).toBe(true);
  });

  it("treats a missing workflow status like a draft", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: null,
        documentStatus: "active",
        recipients: [signer],
        fields: [{ recipientId: "s1", fieldType: "initials" }],
      }).canSend
    ).toBe(true);
  });

  it("refuses a document that is already out for signature", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "sent",
        documentStatus: "active",
        recipients: [signer],
        fields: [{ recipientId: "s1" }],
      })
    ).toEqual({ canSend: false, tooltip: "Only a draft can be sent." });
  });

  it("lets an expired document be sent again", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "expired",
        documentStatus: "active",
        recipients: [signer],
        fields: [{ recipientId: "s1", fieldType: "free_signature" }],
      }).canSend
    ).toBe(true);
  });

  it("asks for a recipient before any other field problem", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [],
        fields: [{ recipientId: null }],
      }).tooltip
    ).toBe("Add a recipient before sending.");
  });

  it("blocks unassigned fields", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "uploaded",
        documentStatus: "active",
        recipients: [signer],
        fields: [
          { recipientId: "s1", fieldType: "signature" },
          { recipientId: null, fieldType: "text" },
        ],
      }).tooltip
    ).toBe(
      "1 field is not assigned to a recipient. Assign it before sending."
    );
  });

  it("pluralizes several unassigned fields", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [signer],
        fields: [
          { recipientId: "s1", fieldType: "signature" },
          { recipientId: null },
          { recipientId: null },
        ],
      }).tooltip
    ).toBe(
      "2 fields are not assigned to a recipient. Assign them before sending."
    );
  });

  it("names every signer who has no field", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [
          signer,
          { _id: "s2", role: "signer", email: "sue@ex.com", name: null },
          { _id: "v", role: "viewer", email: "v@ex.com", name: "Vi" },
        ],
        fields: [{ recipientId: "s1", fieldType: "signature" }],
      }).tooltip
    ).toBe("sue@ex.com needs a signature or initials field before this can be sent.");
  });

  it("does not treat a text field as something a signer can sign", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [signer],
        fields: [{ recipientId: "s1", fieldType: "text" }],
      }).tooltip
    ).toBe(
      "Sam needs a signature or initials field before this can be sent."
    );
  });

  it("counts a signature, initials, or free signature", () => {
    expect(isSigningFieldType("signature")).toBe(true);
    expect(isSigningFieldType("initials")).toBe(true);
    expect(isSigningFieldType("free_signature")).toBe(true);
    expect(isSigningFieldType("text")).toBe(false);
    expect(
      countSigningFields([
        { fieldType: "text" },
        { fieldType: "initials" },
        { fieldType: "signature" },
      ])
    ).toBe(2);
  });

  it("can send a document whose only people are approvers or viewers", () => {
    expect(
      sendDocumentReadiness({
        workflowStatus: "draft",
        documentStatus: "active",
        recipients: [
          { _id: "a", role: "approver", email: "a@ex.com", name: "Ada" },
        ],
        fields: [],
      }).canSend
    ).toBe(true);
  });
});

describe("Fields and clicking the page", () => {
  it("opens add recipient from Fields when a draft has no signer", () => {
    expect(resolvePlaceFieldsIntent({ canEdit: true, signerCount: 0 })).toBe(
      "add-recipient"
    );
  });

  it("does nothing from Fields when the document is no longer editable", () => {
    expect(resolvePlaceFieldsIntent({ canEdit: false, signerCount: 0 })).toBe(
      "stay"
    );
  });

  it("opens the field list when a signer is already chosen", () => {
    expect(resolvePlaceFieldsIntent({ canEdit: true, signerCount: 1 })).toBe(
      "open-fields"
    );
  });

  it("refuses a page click during setup, asks for a signer, then places", () => {
    expect(
      resolvePagePlaceIntent({ fieldSetupOpen: true, signerCount: 1 })
    ).toBe("finish-field");
    expect(
      resolvePagePlaceIntent({ fieldSetupOpen: false, signerCount: 0 })
    ).toBe("add-recipient");
    expect(
      resolvePagePlaceIntent({ fieldSetupOpen: false, signerCount: 2 })
    ).toBe("place");
  });
});
