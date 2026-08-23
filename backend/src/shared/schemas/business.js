"use strict";

const { z } = require("zod");

const dayHoursSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean().default(false),
});

const workingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

const updateBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  codEnabled: z.boolean().optional(),
  workingHours: workingHoursSchema.optional(),
});

const DEFAULT_WORKING_HOURS = {
  monday: { open: "09:00", close: "21:00", closed: false },
  tuesday: { open: "09:00", close: "21:00", closed: false },
  wednesday: { open: "09:00", close: "21:00", closed: false },
  thursday: { open: "09:00", close: "21:00", closed: false },
  friday: { open: "09:00", close: "21:00", closed: false },
  saturday: { open: "09:00", close: "21:00", closed: false },
  sunday: { open: "09:00", close: "21:00", closed: true },
};

module.exports = {
  workingHoursSchema,
  updateBusinessSchema,
  DEFAULT_WORKING_HOURS,
};
