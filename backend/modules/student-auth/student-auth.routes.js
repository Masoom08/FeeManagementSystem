const express = require("express");
const { validate } = require("../../middleware/validate");
const controller = require("./student-auth.controller");
const schemas = require("./student-auth.validation");
const { authenticateStudent } = require("../../middleware/authenticate");

const router = express.Router();
router.post("/request-otp", validate({ body: schemas.requestOtpBody }), controller.requestOtp);
router.post("/verify-otp", validate({ body: schemas.verifyOtpBody }), controller.verifyOtp);
router.get("/me", authenticateStudent, controller.getProfile);
router.get("/receipts", authenticateStudent, controller.listReceipts);
router.get("/receipts/:paymentId", authenticateStudent, validate({ params: schemas.paymentIdParams }), controller.getReceipt);
router.post("/payments", authenticateStudent, validate({ body: schemas.createPaymentBody }), controller.createPayment);
router.post("/payments/:orderId/mock-success", authenticateStudent, validate({ params: schemas.orderIdParams }), controller.mockPaymentSuccess);
router.post("/payments/:orderId/mock-failure", authenticateStudent, validate({ params: schemas.orderIdParams }), controller.mockPaymentFailure);
router.post("/logout", authenticateStudent, controller.logout);

module.exports = router;
