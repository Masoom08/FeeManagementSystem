const { z } = require("zod");
const { actedBy, idParams } = require("../../lib/ids");

const createReminderBody = z
  .object({
    studentIds: z.array(z.number().int().positive()).min(1, "at least one student is required"),
    channels: z.array(z.enum(["SMS", "WHATSAPP"])).min(1, "at least one channel is required"),
    actedBy,
    message: z.string().trim().min(1).max(1600).optional(),
  })
  .strict();

const listQuery = z
  .object({
    unpaid: z.enum(["true", "false"]).optional(),
  })
  .strict();

module.exports = {
  createReminderBody,
  listQuery,
  idParams: idParams(),
};
