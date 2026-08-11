import { Router } from "express";
import { getQueueMode } from "../lib/queue";

export const queueRouter = Router();

queueRouter.get("/queue/status", (_req, res) => {
  res.json({
    data: {
      driver: getQueueMode(),
    },
  });
});
