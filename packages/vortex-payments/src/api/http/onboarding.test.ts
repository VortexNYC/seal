import { describe, expect, test } from "vitest";
import type { MerchantOnboardingService } from "../../application/merchant-onboarding/service";
import { MerchantOnboardingServiceError } from "../../application/merchant-onboarding/impl";
import { createOnboardingHttpHandlers } from "./onboarding";

const consent = {
  merchantAgreementAccepted: true,
  merchantAgreementAcceptedAt: "2026-04-23T00:00:00.000Z",
  merchantAgreementIpAddress: "203.0.113.10",
  merchantAgreementUserAgent: "VortexTest/1.0",
} as const;

function createService(): MerchantOnboardingService {
  return {
    async submitMerchantOnboarding() {
      return {
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        status: "under_review",
        requirementIds: ["req_123"],
        openRequirementIds: ["req_123"],
      };
    },
    async getMerchantOnboardingSnapshot() {
      return null;
    },
    async refreshMerchantOnboardingSession() {
      return {
        snapshot: {
          merchantAccountId: "merchant_123",
          onboardingSessionId: "onb_123",
          status: "action_required",
          requirementIds: ["req_123"],
          openRequirementIds: ["req_123"],
        },
        requirements: [
          {
            requirementId: "req_123",
            requirementType: "compliance_form",
            status: "pending",
            title: "Upload document",
            sourceProvider: "finix",
          },
        ],
      };
    },
    async listMerchantRequirements() {
      return [
        {
          requirementId: "req_123",
          requirementType: "provider_requirement",
          status: "pending",
          title: "Upload document",
          sourceProvider: "finix",
        },
      ];
    },
    async listMerchantRequirementDocuments() {
      return [
        {
          requirementId: "req_123",
          documentId: "file_123",
          uploadLinkId: "link_123",
          fileName: "owner-license.png",
          contentType: "image/png",
          requestedAt: "2026-05-14T14:00:00.000Z",
          uploadedByType: "merchant",
          uploadedByRef: "merchant_user_123",
          provider: "finix",
          status: "UPLOADED",
          recordedAt: "2026-05-14T14:30:00.000Z",
        },
      ];
    },
    async satisfyMerchantRequirements() {
      return {
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        status: "under_review",
        requirementIds: ["req_123"],
        openRequirementIds: ["req_123"],
      };
    },
    async refreshMerchantRequirement() {
      return {
        requirement: {
          requirementId: "req_123",
          requirementType: "provider_requirement",
          status: "submitted",
          title: "Upload document",
          sourceProvider: "finix",
        },
        documents: [
          {
            requirementId: "req_123",
            documentId: "file_123",
            uploadLinkId: "link_123",
            fileName: "owner-license.png",
            contentType: "image/png",
            requestedAt: "2026-05-14T14:00:00.000Z",
            uploadedByType: "merchant",
            uploadedByRef: "merchant_user_123",
            provider: "finix",
            status: "UPLOADED",
            recordedAt: "2026-05-14T14:30:00.000Z",
          },
        ],
      };
    },
    async createRequirementUploadLink() {
      return {
        requirementId: "req_123",
        documentId: "file_123",
        uploadLinkId: "link_123",
        uploadUrl: "https://upload.example/link_123",
        expiresAt: "2026-05-14T15:00:00.000Z",
      };
    },
    async getRequirementUploadStatus() {
      return {
        requirementId: "req_123",
        documentId: "file_123",
        uploadLinkId: "link_123",
        provider: "finix",
        status: "UPLOADED",
        recordedAt: "2026-05-14T14:30:00.000Z",
      };
    },
  };
}

function expectNoProviderLeak(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("finix");
  expect(serialized).not.toContain("sourceProvider");
  expect(serialized).not.toContain("providerRequirementRef");
  expect(serialized).not.toContain('"provider"');
}

describe("createOnboardingHttpHandlers", () => {
  test("returns success response for onboarding submit", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_123",
    });

    const response = await handlers.submitMerchantOnboarding({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        submittedByType: "operator",
        submittedByRef: "user_123",
        consent,
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          merchantAccountId: "merchant_123",
          onboardingSessionId: "onb_123",
          status: "under_review",
          requirementIds: ["req_123"],
          openRequirementIds: ["req_123"],
        },
        requestId: "req_123",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement remediation submit", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_789",
    });

    const response = await handlers.satisfyMerchantRequirements({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        submissions: [{ requirementId: "req_123", documentIds: ["file_123"] }],
        submittedByType: "merchant",
        submittedByRef: "merchant_user_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          merchantAccountId: "merchant_123",
          onboardingSessionId: "onb_123",
          status: "under_review",
          requirementIds: ["req_123"],
          openRequirementIds: ["req_123"],
        },
        requestId: "req_789",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for onboarding session refresh", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_session_refresh",
    });

    const response = await handlers.refreshMerchantOnboardingSession({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          snapshot: {
            merchantAccountId: "merchant_123",
            onboardingSessionId: "onb_123",
            status: "action_required",
            requirementIds: ["req_123"],
            openRequirementIds: ["req_123"],
          },
          requirements: [
            {
              requirementId: "req_123",
              requirementType: "onboarding_requirement",
              status: "pending",
              title: "Onboarding requirement pending",
            },
          ],
        },
        requestId: "req_session_refresh",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement list", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_requirements",
    });

    const response = await handlers.listMerchantRequirements({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: [
          {
            requirementId: "req_123",
            requirementType: "onboarding_requirement",
            status: "pending",
            title: "Onboarding requirement pending",
          },
        ],
        requestId: "req_requirements",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement document list", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_docs",
    });

    const response = await handlers.listMerchantRequirementDocuments({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        requirementId: "req_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: [
          {
            requirementId: "req_123",
            documentId: "file_123",
            uploadLinkId: "link_123",
            fileName: "owner-license.png",
            contentType: "image/png",
            requestedAt: "2026-05-14T14:00:00.000Z",
            uploadedByType: "merchant",
            uploadedByRef: "merchant_user_123",
            status: "UPLOADED",
            recordedAt: "2026-05-14T14:30:00.000Z",
          },
        ],
        requestId: "req_docs",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement refresh", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_refresh",
    });

    const response = await handlers.refreshMerchantRequirement({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        requirementId: "req_123",
      },
    });

    expect(response).toEqual({
      status: 202,
      body: {
        data: {
          requirement: {
            requirementId: "req_123",
            requirementType: "onboarding_requirement",
            status: "submitted",
            title: "Onboarding requirement pending",
          },
          documents: [
            {
              requirementId: "req_123",
              documentId: "file_123",
              uploadLinkId: "link_123",
              fileName: "owner-license.png",
              contentType: "image/png",
              requestedAt: "2026-05-14T14:00:00.000Z",
              uploadedByType: "merchant",
              uploadedByRef: "merchant_user_123",
              status: "UPLOADED",
              recordedAt: "2026-05-14T14:30:00.000Z",
            },
          ],
        },
        requestId: "req_refresh",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement upload link creation", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_upload",
    });

    const response = await handlers.createRequirementUploadLink({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        requirementId: "req_123",
        fileName: "owner-license.png",
        contentType: "image/png",
        uploadedByType: "merchant",
        uploadedByRef: "merchant_user_123",
      },
    });

    expect(response).toEqual({
      status: 201,
      body: {
        data: {
          requirementId: "req_123",
          documentId: "file_123",
          uploadLinkId: "link_123",
          uploadUrl: "https://upload.example/link_123",
          expiresAt: "2026-05-14T15:00:00.000Z",
        },
        requestId: "req_upload",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("returns success response for requirement upload status", async () => {
    const handlers = createOnboardingHttpHandlers({
      service: createService(),
      createRequestId: () => "req_upload_status",
    });

    const response = await handlers.getRequirementUploadStatus({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_123",
        requirementId: "req_123",
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        data: {
          requirementId: "req_123",
          documentId: "file_123",
          uploadLinkId: "link_123",
          status: "UPLOADED",
          recordedAt: "2026-05-14T14:30:00.000Z",
        },
        requestId: "req_upload_status",
      },
    });
    expectNoProviderLeak(response.body);
  });

  test("maps service error to http error", async () => {
    const service: MerchantOnboardingService = {
      ...createService(),
      async submitMerchantOnboarding() {
        throw new MerchantOnboardingServiceError("provider_unavailable", "provider down", {
          retryable: true,
        });
      },
    };

    const handlers = createOnboardingHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.submitMerchantOnboarding({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        submittedByType: "operator",
        submittedByRef: "user_123",
        consent,
      },
    });

    expect(response).toEqual({
      status: 503,
      body: {
        code: "provider_unavailable",
        category: "merchant_onboarding_service",
        message: "provider down",
        actionRequired: false,
        retryable: true,
        requestId: "req_456",
      },
    });
  });
});
