const { asyncRoute } = require("../../lib/asyncRoute");
const reminderService = require("./reminder.service");

const sendReminders = asyncRoute(async (req, res) => {
  const reminders = await reminderService.sendReminders(req.body);
  res.status(201).json({ success: true, data: reminders });
});

const listReminders = asyncRoute(async (req, res) => {
  const reminders = await reminderService.listReminders(req.query.unpaid === "true");
  res.status(200).json({ success: true, data: reminders });
});

module.exports = {
  sendReminders,
  listReminders,
};
