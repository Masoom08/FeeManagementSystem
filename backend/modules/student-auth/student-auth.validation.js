const { z } = require("zod");
const { idParams } = require("../../lib/ids");

const phoneNumber = z.string().trim().min(10).max(20);

const requestOtpBody = z.object({ phoneNumber }).strict();
const verifyOtpBody = z.object({
  phoneNumber,
  otp: z.string().trim().regex(/^\d{6}$/),
}).strict();

const createPaymentBody = z.object({
  amount: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(80),
}).strict();
const orderIdParams = z.object({ orderId: z.string().trim().min(1).max(80) }).strict();

module.exports = { requestOtpBody, verifyOtpBody, createPaymentBody, orderIdParams, paymentIdParams: idParams("paymentId") };
