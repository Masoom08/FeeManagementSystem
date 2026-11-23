const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./fee.validation");
const controller = require("./fee.controller");
const { requireSuperAdmin } = require("../../middleware/authenticate");

const academicYears = express.Router();
academicYears.post("/", requireSuperAdmin, validate({ body: schemas.createAcademicYearBody }), controller.createAcademicYear);
academicYears.get("/", controller.listAcademicYears);
academicYears.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewAcademicYearDelete);
academicYears.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteAcademicYear);

const semesters = express.Router();
semesters.post("/", requireSuperAdmin, validate({ body: schemas.createSemesterBody }), controller.createSemester);
semesters.get("/", controller.listSemesters);
semesters.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewSemesterDelete);
semesters.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteSemester);

const feeStructures = express.Router();
feeStructures.post("/", requireSuperAdmin, validate({ body: schemas.createFeeStructureBody }), controller.createFeeStructure);
feeStructures.get("/", controller.listFeeStructures);
feeStructures.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewFeeStructureDelete);
feeStructures.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteFeeStructure);

const hostelRates = express.Router();
hostelRates.get("/", controller.listHostelRates);
hostelRates.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewHostelRateDelete);
hostelRates.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteHostelRate);

const fees = express.Router();
fees.get("/accounts/:id", validate({ params: schemas.idParams }), controller.getAccount);
fees.post("/fines/run", requireSuperAdmin, validate({ body: schemas.runFinesBody }), controller.runFines);
fees.post("/fines/:entryId/waive", requireSuperAdmin, validate({ params: schemas.entryIdParams, body: schemas.waiveFineBody }), controller.waiveFine);
fees.post(
  "/deposits/:accountId/refund",
  requireSuperAdmin,
  validate({ params: schemas.accountIdParams, body: schemas.refundDepositBody }),
  controller.refundDeposit
);
fees.post(
  "/deposits/:accountId/adjust",
  requireSuperAdmin,
  validate({ params: schemas.accountIdParams, body: schemas.adjustDepositBody }),
  controller.adjustDeposit
);

module.exports = {
  academicYears,
  semesters,
  feeStructures,
  hostelRates,
  fees,
};
