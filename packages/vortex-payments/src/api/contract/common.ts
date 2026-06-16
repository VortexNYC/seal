import type { Environment, IsoTimestamp, Metadata } from "../../domain/common";

export interface ApiSuccess<T> {
  readonly data: T;
  readonly requestId: string;
}

export interface ApiError {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "forbidden"
    | "not_allowed"
    | "action_required"
    | "rate_limited"
    | "provider_unavailable"
    | "internal_error";
  readonly category: string;
  readonly message: string;
  readonly actionRequired?: boolean;
  readonly retryable?: boolean;
  readonly requestId: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface ResourceTimestamps {
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface EnvironmentScoped {
  readonly environment: Environment;
}

export interface MetadataCarrier {
  readonly metadata?: Metadata;
}
