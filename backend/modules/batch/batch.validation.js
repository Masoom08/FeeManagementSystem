const { z } = require("zod");
const { isoDate } = require("../../lib/ids");

const createBatchBody = z.object({
  courseId: z.number().int().positive(),
  label: z.string().trim().min(1).max(20),
  startDate: isoDate,
  endDate: isoDate,
}).strict();

module.exports = { createBatchBody };
