import type { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, code: string, status = 500, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    details: { path: req.path }
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    details: {}
  });
}
