import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isAppError } from "../lib/errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
    return;
  }

  if (isAppError(err)) {
    res.status(err.statusCode).json({
      error: {
        code: err.code ?? "APP_ERROR",
        message: err.message,
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    },
  });
}
