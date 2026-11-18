const { asyncRoute } = require("../../lib/asyncRoute");
const paymentService = require("./payment.service");

const createPayment = asyncRoute(async (req, res) => {
  const payment = await paymentService.createPayment(req.body);
  const status = payment.status === "SUCCESS" ? 201 : 201;
  res.status(status).json({ success: true, data: payment });
});

const callback = asyncRoute(async (req, res) => {
  const payment = await paymentService.callback(req.params.id, req.body);
  res.status(200).json({ success: true, data: payment });
});

const verify = asyncRoute(async (req, res) => {
  const payment = await paymentService.verify(req.params.id, req.body);
  res.status(200).json({ success: true, data: payment });
});

const getReceipt = asyncRoute(async (req, res) => {
  const receipt = await paymentService.getReceipt(req.params.paymentId);
  res.status(200).json({ success: true, data: receipt });
});

module.exports = {
  createPayment,
  callback,
  verify,
  getReceipt,
};
