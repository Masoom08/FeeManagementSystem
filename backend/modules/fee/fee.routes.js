const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./fee.validation");
const controller = require("./fee.controller");
const { requireSuperAdmin, requireFeeAdmin } = require("../../middleware/authenticate");

const sessions = express.Router();
sessions.post("/", requireSuperAdmin, validate({ body: schemas.createSessionBody }), controller.createSession);
sessions.get("/", controller.listSessions);
sessions.patch("/:id", requireSuperAdmin, validate({ params: schemas.idParams, body: schemas.updateSessionBody }), controller.updateSession);
sessions.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteSession);

const semesters = express.Router();
semesters.post("/", requireSuperAdmin, validate({ body: schemas.createSemesterBody }), controller.createSemester);
semesters.get("/", controller.listSemesters);
semesters.patch("/:id", requireSuperAdmin, validate({ params: schemas.idParams, body: schemas.updateSemesterBody }), controller.updateSemester);
semesters.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteSemester);

const feeStructures = express.Router();
feeStructures.post("/", requireSuperAdmin, validate({ body: schemas.createFeeStructureBody }), controller.createFeeStructure);
feeStructures.get("/", validate({ query: schemas.feeStructuresQuery }), controller.listFeeStructures);
feeStructures.patch("/:id", requireSuperAdmin, validate({ params: schemas.idParams, body: schemas.updateFeeStructureBody }), controller.updateFeeStructure);
feeStructures.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteFeeStructure);

const hostelRates = express.Router();
hostelRates.get("/", controller.listHostelRates);

const fees = express.Router();
fees.get("/late-fees", controller.getLateFeeDashboard);
fees.post("/late-fees/students/:studentId/waive", requireFeeAdmin, validate({ params: schemas.studentIdParams, body: schemas.waiveLateFeeBody }), controller.waiveLateFeeForStudent);
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
  sessions,
  semesters,
  feeStructures,
  hostelRates,
  fees,
};
