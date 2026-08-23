"use strict";

const express = require("express");
const { getQueueMode } = require("../lib/queue");

const queueRouter = express.Router();

queueRouter.get("/queue/status", (_req, res) => {
  res.json({
    data: {
      driver: getQueueMode(),
    },
  });
});

module.exports = { queueRouter };
