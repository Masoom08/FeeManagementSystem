const { asyncRoute } = require("../../lib/asyncRoute");
const feeService = require("./fee.service");

const createAcademicYear = asyncRoute(async (req, res) => {
  const year = await feeService.createAcademicYear(req.body);
  res.status(201).json({ success: true, data: year });
});

const listAcademicYears = asyncRoute(async (req, res) => {
  const years = await feeService.listAcademicYears();
  res.status(200).json({ success: true, data: years });
});

const createSemester = asyncRoute(async (req, res) => {
  const semester = await feeService.createSemester(req.body);
  res.status(201).json({ success: true, data: semester });
});

const listSemesters = asyncRoute(async (req, res) => {
  const semesters = await feeService.listSemesters();
  res.status(200).json({ success: true, data: semesters });
});

const createFeeStructure = asyncRoute(async (req, res) => {
  const structure = await feeService.createFeeStructure(req.body);
  res.status(201).json({ success: true, data: structure });
});

const listFeeStructures = asyncRoute(async (req, res) => {
  const structures = await feeService.listFeeStructures();
  res.status(200).json({ success: true, data: structures });
});

const listHostelRates = asyncRoute(async (req, res) => {
  const rates = await feeService.listHostelRates();
  res.status(200).json({ success: true, data: rates });
});

const getAccount = asyncRoute(async (req, res) => {
  const account = await feeService.getAccount(req.params.id);
  res.status(200).json({ success: true, data: account });
});

const runFines = asyncRoute(async (req, res) => {
  const result = await feeService.runFines(req.body);
  res.status(200).json({ success: true, data: result });
});

const waiveFine = asyncRoute(async (req, res) => {
  const line = await feeService.waiveFine(req.params.entryId, req.body);
  res.status(201).json({ success: true, data: line });
});

const refundDeposit = asyncRoute(async (req, res) => {
  const result = await feeService.refundDeposit(req.params.accountId, req.body);
  res.status(201).json({ success: true, data: result });
});

const adjustDeposit = asyncRoute(async (req, res) => {
  const result = await feeService.adjustDeposit(req.params.accountId, req.body);
  res.status(201).json({ success: true, data: result });
});

const previewAcademicYearDelete = asyncRoute(async (req, res) => {
  const impact = await feeService.previewAcademicYearDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteAcademicYear = asyncRoute(async (req, res) => {
  const result = await feeService.deleteAcademicYear(req.params.id);
  res.status(200).json({ success: true, data: result });
});

const previewSemesterDelete = asyncRoute(async (req, res) => {
  const impact = await feeService.previewSemesterDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteSemester = asyncRoute(async (req, res) => {
  const result = await feeService.deleteSemester(req.params.id);
  res.status(200).json({ success: true, data: result });
});

const previewFeeStructureDelete = asyncRoute(async (req, res) => {
  const impact = await feeService.previewFeeStructureDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteFeeStructure = asyncRoute(async (req, res) => {
  const result = await feeService.deleteFeeStructure(req.params.id);
  res.status(200).json({ success: true, data: result });
});

const previewHostelRateDelete = asyncRoute(async (req, res) => {
  const impact = await feeService.previewHostelRateDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteHostelRate = asyncRoute(async (req, res) => {
  const result = await feeService.deleteHostelRate(req.params.id);
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  createAcademicYear,
  listAcademicYears,
  createSemester,
  listSemesters,
  createFeeStructure,
  listFeeStructures,
  listHostelRates,
  getAccount,
  runFines,
  waiveFine,
  refundDeposit,
  adjustDeposit,
  previewAcademicYearDelete,
  deleteAcademicYear,
  previewSemesterDelete,
  deleteSemester,
  previewFeeStructureDelete,
  deleteFeeStructure,
  previewHostelRateDelete,
  deleteHostelRate,
};
