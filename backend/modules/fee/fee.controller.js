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

const updateAcademicYear = asyncRoute(async (req, res) => {
  const year = await feeService.updateAcademicYear(Number(req.params.id), req.body);
  res.status(200).json({ success: true, data: year });
});

const deleteAcademicYear = asyncRoute(async (req, res) => {
  const result = await feeService.deleteAcademicYear(Number(req.params.id));
  res.status(200).json({ success: true, data: result });
});

const createSemester = asyncRoute(async (req, res) => {
  const semester = await feeService.createSemester(req.body);
  res.status(201).json({ success: true, data: semester });
});

const listSemesters = asyncRoute(async (req, res) => {
  const semesters = await feeService.listSemesters();
  res.status(200).json({ success: true, data: semesters });
});

const updateSemester = asyncRoute(async (req, res) => {
  const semester = await feeService.updateSemester(Number(req.params.id), req.body);
  res.status(200).json({ success: true, data: semester });
});

const deleteSemester = asyncRoute(async (req, res) => {
  const result = await feeService.deleteSemester(Number(req.params.id));
  res.status(200).json({ success: true, data: result });
});

const createFeeStructure = asyncRoute(async (req, res) => {
  const structure = await feeService.createFeeStructure(req.body);
  res.status(201).json({ success: true, data: structure });
});

const listFeeStructures = asyncRoute(async (req, res) => {
  const structures = await feeService.listFeeStructures(req.query.academicYearId);
  res.status(200).json({ success: true, data: structures });
});

const updateFeeStructure = asyncRoute(async (req, res) => {
  const structure = await feeService.updateFeeStructure(Number(req.params.id), req.body);
  res.status(200).json({ success: true, data: structure });
});

const deleteFeeStructure = asyncRoute(async (req, res) => {
  const result = await feeService.deleteFeeStructure(Number(req.params.id));
  res.status(200).json({ success: true, data: result });
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

module.exports = {
  createAcademicYear,
  listAcademicYears,
  updateAcademicYear,
  deleteAcademicYear,
  createSemester,
  listSemesters,
  updateSemester,
  deleteSemester,
  createFeeStructure,
  listFeeStructures,
  updateFeeStructure,
  deleteFeeStructure,
  listHostelRates,
  getAccount,
  runFines,
  waiveFine,
  refundDeposit,
  adjustDeposit,
};
