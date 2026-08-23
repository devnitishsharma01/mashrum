"use strict";

const { z } = require("zod");
const { isAppError } = require("../lib/errors");

function errorHandler(err, _req, res, _next) {
  if (err instanceof z.ZodError) {
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

module.exports = { errorHandler };
