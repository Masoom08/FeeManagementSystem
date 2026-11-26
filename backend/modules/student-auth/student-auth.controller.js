const { asyncRoute } = require("../../lib/asyncRoute");
const studentAuthService = require("./student-auth.service");

const requestOtp = asyncRoute(async (req, res) => {
  const result = await studentAuthService.requestOtp(req.body.phoneNumber);
  res.status(200).json({ success: true, data: result });
});

const verifyOtp = asyncRoute(async (req, res) => {
  const result = await studentAuthService.verifyOtp(req.body.phoneNumber, req.body.otp);
  res.status(200).json({ success: true, data: result });
});

const listReceipts = asyncRoute(async (req, res) => {
  const receipts = await studentAuthService.listReceipts(req.auth.studentId);
  res.status(200).json({ success: true, data: receipts });
});

const getProfile = asyncRoute(async (req, res) => {
  res.status(200).json({ success: true, data: await studentAuthService.getProfile(req.auth.studentId) });
});

const chooseHostelSeat = asyncRoute(async (req, res) => {
  const profile = await studentAuthService.chooseHostelSeat(req.auth.studentId, req.body.hostelRateId);
  res.status(200).json({ success: true, data: profile });
});

const getReceipt = asyncRoute(async (req, res) => {
  res.status(200).json({ success: true, data: await studentAuthService.getStudentReceipt(req.auth.studentId, Number(req.params.paymentId)) });
});

const createPayment = asyncRoute(async (req, res) => {
  res.status(201).json({ success: true, data: await studentAuthService.createStudentPayment(req.auth.studentId, req.body) });
});

const mockPaymentSuccess = asyncRoute(async (req, res) => {
  const result = await studentAuthService.completeMockPayment(req.auth.studentId, req.params.orderId, "SUCCESS");
  res.status(200).json({ success: true, data: result });
});

const mockPaymentFailure = asyncRoute(async (req, res) => {
  const result = await studentAuthService.completeMockPayment(req.auth.studentId, req.params.orderId, "FAILED");
  res.status(200).json({ success: true, data: result });
});

const logout = asyncRoute(async (_req, res) => {
  res.status(200).json({ success: true, data: { message: "Signed out. Remove the bearer token from the client." } });
});

module.exports = { requestOtp, verifyOtp, listReceipts, getReceipt, getProfile, chooseHostelSeat, createPayment, mockPaymentSuccess, mockPaymentFailure, logout };
