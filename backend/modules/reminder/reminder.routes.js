const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./reminder.validation");
const controller = require("./reminder.controller");

const router = express.Router();

router.post("/", validate({ body: schemas.createReminderBody }), controller.sendReminders);
router.get("/", validate({ query: schemas.listQuery }), controller.listReminders);

module.exports = router;
