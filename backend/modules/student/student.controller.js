const { asyncRoute } = require("../../lib/asyncRoute");
const studentService = require("./student.service");

const createStudent = asyncRoute(async (req, res) => {
  const student = await studentService.createStudent(req.body);
  res.status(201).json({ success: true, data: student });
});

const searchStudents = asyncRoute(async (req, res) => {
  const students = await studentService.searchStudents(req.query.q);
  res.status(200).json({ success: true, data: students });
});

const getStudent = asyncRoute(async (req, res) => {
  const student = await studentService.getStudent(req.params.id);
  res.status(200).json({ success: true, data: student });
});

const updateStudent = asyncRoute(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.body);
  res.status(200).json({ success: true, data: student });
});

const updateStudentYear = asyncRoute(async (req, res) => {
  const row = await studentService.updateStudentYear(req.params.id, req.params.sessionId, req.body);
  res.status(200).json({ success: true, data: row });
});

const previewImport = asyncRoute(async (req, res) => {
  const batch = await studentService.previewImport(req.file);
  res.status(200).json({ success: true, data: batch });
});

const commitImport = asyncRoute(async (req, res) => {
  const result = await studentService.commitImport(req.params.id);
  res.status(201).json({ success: true, data: result });
});

const previewStudentDelete = asyncRoute(async (req, res) => {
  const impact = await studentService.previewStudentDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteStudent = asyncRoute(async (req, res) => {
  const result = await studentService.deleteStudent(req.params.id);
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  createStudent,
  searchStudents,
  getStudent,
  updateStudent,
  updateStudentYear,
  previewImport,
  commitImport,
  previewStudentDelete,
  deleteStudent,
};
