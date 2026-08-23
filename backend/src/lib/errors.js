"use strict";

class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }
}

function isAppError(error) {
  return error instanceof AppError;
}

module.exports = { AppError, isAppError };
