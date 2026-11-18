const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./report.validation");
const controller = require("./report.controller");

const router = express.Router();

router.get("/dashboard", controller.dashboardSummary);
router.get("/course-collections", controller.courseCollections);
router.get("/payments", validate({ query: schemas.paymentsQuery }), controller.payments);
router.get("/unpaid", validate({ query: schemas.courseQuery }), controller.unpaid);
router.get("/failed-payments", controller.failedPayments);
router.get("/on-time", validate({ query: schemas.semesterQuery }), controller.onTime);
router.get("/waivers", validate({ query: schemas.semesterQuery }), controller.waivers);
router.get("/left-students", controller.leftStudents);
router.get("/fines", validate({ query: schemas.semesterQuery }), controller.fines);
router.get("/reconciliation", validate({ query: schemas.courseQuery }), controller.reconciliation);

module.exports = router;
