
const { asyncRoute } = require("../../lib/asyncRoute");
const feeService = require("./fee.service");

const createSession = asyncRoute(async (req, res) => {
  const year = await feeService.createSession(req.body);
  res.status(201).json({ success: true, data: year });
});

const listSessions = asyncRoute(async (req, res) => {
  const years = await feeService.listSessions();
  res.status(200).json({ success: true, data: years });
});

const updateSession = asyncRoute(async (req, res) => {
  const year = await feeService.updateSession(Number(req.params.id), req.body);
  res.status(200).json({ success: true, data: year });
});

const deleteSession = asyncRoute(async (req, res) => {
  const result = await feeService.deleteSession(Number(req.params.id));
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

const createFeeStructure = asyncRoute(async (req, res) => {
  const structure = await feeService.createFeeStructure(req.body);
  res.status(201).json({ success: true, data: structure });
});

const updateFeeStructure = asyncRoute(async (req, res) => {
  const structure = await feeService.updateFeeStructure(req.params.id, req.body);
  res.status(200).json({ success: true, data: structure });
});

const listFeeStructures = asyncRoute(async (req, res) => {
  const structures = await feeService.listFeeStructures(req.query.sessionId);
  res.status(200).json({ success: true, data: structures });
});

const listHostelSelections = asyncRoute(async (req, res) => {
  const selections = await feeService.listHostelSelections();
  res.status(200).json({ success: true, data: selections });
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

const getLateFeeDashboard = asyncRoute(async (_req, res) => {
  const result = await feeService.getLateFeeDashboard();
  res.status(200).json({ success: true, data: result });
});

const waiveLateFeeForStudent = asyncRoute(async (req, res) => {
  const result = await feeService.waiveLateFeeForStudent(Number(req.params.studentId), req.body);
  res.status(201).json({ success: true, data: result });
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

const updateHostelRate = asyncRoute(async (req, res) => {
  const rate = await feeService.updateHostelRate(req.params.id, req.body);
  res.status(200).json({ success: true, data: rate });
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
  createSession,
  listSessions,
  updateSession,
  deleteSession,
  createSemester,
  listSemesters,
  updateSemester,
  createFeeStructure,
  updateFeeStructure,
  listFeeStructures,
  deleteFeeStructure,
  listHostelRates,
  listHostelSelections,
  updateHostelRate,
  getAccount,
  runFines,
  waiveFine,
  getLateFeeDashboard,
  waiveLateFeeForStudent,
  refundDeposit,
  adjustDeposit,
  previewAcademicYearDelete,
  deleteAcademicYear,
  previewSemesterDelete,
  deleteSemester,
  previewFeeStructureDelete,
  previewHostelRateDelete,
  deleteHostelRate,
};
