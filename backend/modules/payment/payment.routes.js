const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./payment.validation");
const controller = require("./payment.controller");

const payments = express.Router();
payments.get("/history", controller.listPaymentHistory);
payments.post("/", validate({ body: schemas.createPaymentBody }), controller.createPayment);
payments.post("/:id/callback", validate({ params: schemas.idParams, body: schemas.callbackBody }), controller.callback);
payments.post("/:id/verify", validate({ params: schemas.idParams, body: schemas.verifyBody }), controller.verify);

const receipts = express.Router();
receipts.get("/:paymentId", validate({ params: schemas.paymentIdParams }), controller.getReceipt);

module.exports = { payments, receipts };
