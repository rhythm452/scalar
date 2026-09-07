// Mirrors backend/app/schemas/error.py verbatim (docs/API.md §9).
export interface ErrorDetail {
  Type: string;
  Code: string;
  Message: string;
}

export interface ErrorEnvelope {
  Error: ErrorDetail;
  RequestId: string;
}
