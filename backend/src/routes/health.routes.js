"use strict";

const express = require("express");
const { mongoose } = require("../db");

const healthRouter = express.Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB not connected");
    }
    await mongoose.connection.db.admin().ping();
    res.json({
      data: {
        status: "ok",
        service: "mushroom-api",
        database: "up",
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable",
      },
    });
  }
});

module.exports = { healthRouter };
