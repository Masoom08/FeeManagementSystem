const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./fee.validation");
const controller = require("./fee.controller");
const { requireSuperAdmin } = require("../../middleware/authenticate");

const academicYears = express.Router();
academicYears.post("/", requireSuperAdmin, validate({ body: schemas.createAcademicYearBody }), controller.createAcademicYear);
academicYears.get("/", controller.listAcademicYears);

const semesters = express.Router();
semesters.post("/", requireSuperAdmin, validate({ body: schemas.createSemesterBody }), controller.createSemester);
semesters.get("/", controller.listSemesters);

const feeStructures = express.Router();
feeStructures.post("/", requireSuperAdmin, validate({ body: schemas.createFeeStructureBody }), controller.createFeeStructure);
feeStructures.get("/", controller.listFeeStructures);

const hostelRates = express.Router();
hostelRates.get("/", controller.listHostelRates);

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
