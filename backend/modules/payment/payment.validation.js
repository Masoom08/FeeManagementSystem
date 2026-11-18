const { z } = require("zod");
const { actedBy, idParams, isoDate, positiveAmount } = require("../../lib/ids");

const allocation = z
  .object({
    feeAccountId: z.number().int().positive(),
    bucket: z.enum(["DUES", "DEPOSIT"], {
      errorMap: () => ({ message: "bucket must be DUES or DEPOSIT" }),
    }),
    amount: positiveAmount("amount"),
  })
  .strict();

const createPaymentBody = z
  .object({
    method: z.enum(["HDFC", "CHALLAN", "CASH"], {
      errorMap: () => ({ message: "method must be HDFC, CHALLAN, or CASH" }),
    }),
    idempotencyKey: z.string().trim().min(1, "idempotencyKey is required").max(80),
    reference: z.string().trim().min(1).max(80).optional(),
    actedBy: actedBy.optional(),
    paidOn: isoDate.optional(),
    allocations: z.array(allocation).min(1, "at least one allocation is required"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.method === "CASH" || value.method === "CHALLAN") && !value.actedBy) {
      ctx.addIssue({ code: "custom", path: ["actedBy"], message: "actedBy is required" });
    }
    if (value.method === "CHALLAN" && !value.reference) {
      ctx.addIssue({ code: "custom", path: ["reference"], message: "reference is required" });
    }
    const seen = new Set();
    value.allocations.forEach((item, index) => {
      const key = `${item.feeAccountId}:${item.bucket}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index],
          message: "duplicate account and bucket",
        });
      }
      seen.add(key);
    });
  });

const callbackBody = z
  .object({
    status: z.enum(["SUCCESS", "FAILED"], {
      errorMap: () => ({ message: "status must be SUCCESS or FAILED" }),
    }),
    paidOn: isoDate.optional(),
  })
  .strict();

const verifyBody = z
  .object({
    paidOn: isoDate.optional(),
    actedBy: actedBy.optional(),
  })
  .strict();

module.exports = {
  createPaymentBody,
  callbackBody,
  verifyBody,
  idParams: idParams(),
  paymentIdParams: idParams("paymentId"),
};
