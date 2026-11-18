const { asyncRoute } = require("../../lib/asyncRoute");
const reportService = require("./report.service");

const payments = asyncRoute(async (req, res) => {
  const result = await reportService.paymentsReport(req.query);
  if (req.query.format === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"payments.xlsx\"");
    res.setHeader("X-Row-Count", String(result.rowCount));
    res.status(200).send(result.buffer);
    return;
  }
  res.status(200).json({ success: true, data: result });
});

const unpaid = asyncRoute(async (req, res) => {
  const rows = await reportService.unpaidReport(req.query.courseId);
  res.status(200).json({ success: true, data: rows });
});

const failedPayments = asyncRoute(async (req, res) => {
  const rows = await reportService.failedPaymentsReport();
  res.status(200).json({ success: true, data: rows });
});

const onTime = asyncRoute(async (req, res) => {
  const report = await reportService.onTimeReport(req.query.semesterId);
  res.status(200).json({ success: true, data: report });
});

const waivers = asyncRoute(async (req, res) => {
  const report = await reportService.waiverReport(req.query.semesterId);
  res.status(200).json({ success: true, data: report });
});

const leftStudents = asyncRoute(async (req, res) => {
  const rows = await reportService.leftStudentsReport();
  res.status(200).json({ success: true, data: rows });
});

const fines = asyncRoute(async (req, res) => {
  const report = await reportService.fineReport(req.query.semesterId);
  res.status(200).json({ success: true, data: report });
});

const reconciliation = asyncRoute(async (req, res) => {
  const report = await reportService.reconciliationReport(req.query.courseId);
  res.status(200).json({ success: true, data: report });
});

module.exports = {
  payments,
  unpaid,
  failedPayments,
  onTime,
  waivers,
  leftStudents,
  fines,
  reconciliation,
};
