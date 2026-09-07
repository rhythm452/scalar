import type { ErrorEnvelope } from "@/types/api-error";

export class ApiError extends Error {
  readonly type: string;
  readonly code: string;
  readonly requestId: string;
  readonly status: number;

  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.Error.Message);
    this.name = "ApiError";
    this.type = envelope.Error.Type;
    this.code = envelope.Error.Code;
    this.requestId = envelope.RequestId;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
