const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./reminder.validation");
const controller = require("./reminder.controller");
const { requireSuperAdmin } = require("../../middleware/authenticate");

const router = express.Router();

router.post("/", validate({ body: schemas.createReminderBody }), controller.sendReminders);
router.get("/", validate({ query: schemas.listQuery }), controller.listReminders);
router.get("/:id/delete-preview", requireSuperAdmin, validate({ params: schemas.idParams }), controller.previewReminderDelete);
router.delete("/:id", requireSuperAdmin, validate({ params: schemas.idParams }), controller.deleteReminder);

module.exports = router;
