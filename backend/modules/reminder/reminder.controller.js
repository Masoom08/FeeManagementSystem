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

const previewReminderDelete = asyncRoute(async (req, res) => {
  const impact = await reminderService.previewReminderDelete(req.params.id);
  res.status(200).json({ success: true, data: impact });
});

const deleteReminder = asyncRoute(async (req, res) => {
  const result = await reminderService.deleteReminder(req.params.id);
  res.status(200).json({ success: true, data: result });
});

module.exports = {
  sendReminders,
  listReminders,
  previewReminderDelete,
  deleteReminder,
};
