const express = require("express");
const multer = require("multer");
const { validate } = require("../../middleware/validate");
const { badRequest } = require("../../lib/errors");
const schemas = require("./student.validation");
const controller = require("./student.controller");
const { requireSuperAdmin } = require("../../middleware/authenticate");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function uploadSpreadsheet(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return next(badRequest("INVALID_SPREADSHEET", [{ path: "file", message: "file must be an xlsx workbook" }]));
    }
    return next();
  });
}

const router = express.Router();

router.post("/imports/preview", requireSuperAdmin, uploadSpreadsheet, controller.previewImport);
router.post("/imports/:id/commit", requireSuperAdmin, validate({ params: schemas.idParams }), controller.commitImport);
router.post("/", requireSuperAdmin, validate({ body: schemas.createStudentBody }), controller.createStudent);
router.get("/", validate({ query: schemas.searchQuery }), controller.searchStudents);
router.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewStudentDelete);
router.patch("/:id/academic-years/:sessionId", requireSuperAdmin, validate({ params: schemas.academicYearParams, body: schemas.updateStudentYearBody }), controller.updateStudentYear);
router.get("/:id", validate({ params: schemas.idParams }), controller.getStudent);
router.patch("/:id", requireSuperAdmin, validate({ params: schemas.idParams, body: schemas.updateStudentBody }), controller.updateStudent);
router.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteStudent);

module.exports = router;
