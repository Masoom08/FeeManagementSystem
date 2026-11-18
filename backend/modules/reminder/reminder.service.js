const prisma = require("../../lib/prisma");
const { badRequest, httpError, notFound } = require("../../lib/errors");
const { balances } = require("../../lib/balance");

function duesOf(student) {
  return student.feeAccounts.reduce((sum, account) => sum + balances(account.ledgerEntries).duesOutstanding, 0);
}

async function sendReminders(data) {
  const studentIds = [...new Set(data.studentIds)];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { feeAccounts: { include: { ledgerEntries: true } } },
  });
  if (students.length !== studentIds.length) {
    throw notFound();
  }
  const withoutDues = students.filter((student) => duesOf(student) <= 0);
  if (withoutDues.length > 0) {
    throw badRequest(
      "NO_OUTSTANDING_DUES",
      withoutDues.map((student) => ({
        path: "studentIds",
        message: `student ${student.id} has no outstanding dues`,
      }))
    );
  }

  if (data.channels.includes("SMS")) {
    const apiUrl = process.env.SMS_API_URL;
    if (!apiUrl || !process.env.SMS_API_KEY || !process.env.SMS_SENDER_ID || !process.env.SMS_TYPE) {
      throw httpError(503, "SMS_PROVIDER_NOT_CONFIGURED");
    }
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw httpError(503, "SMS_PROVIDER_CONFIG_INVALID");
    }
    if (parsedApiUrl.protocol !== "https:") {
      throw httpError(503, "SMS_PROVIDER_REQUIRES_HTTPS");
    }
  }

  const sent = [];
  const failed = [];
  for (const student of students) {
    for (const channel of data.channels) {
      if (channel !== "SMS") {
        failed.push({ studentId: student.id, channel, reason: "CHANNEL_NOT_CONFIGURED" });
        continue;
      }

      const message = data.message ||
          `Dear ${student.name}, our records show an outstanding fee balance of INR ${duesOf(student)}. Please contact the accounts office to complete your payment. If you have already paid, kindly ignore this message.`;
      try {
        console.log(`[SMS] Sending to ${student.phoneNumber || "NA"}. Message: "${message}"`);
        const providerResult = await sendSms(student.phoneNumber, message);
        const reminder = await prisma.reminder.create({
          data: { studentId: student.id, channel, actedBy: data.actedBy },
        });
        console.log(`[SMS] Sent to ${student.phoneNumber || "NA"}. Provider response: ${providerResult || "NA"}`);
        sent.push({ studentId: student.id, channel, reminderId: reminder.id });
      } catch (error) {
        const reason = error.code || error.message || "SMS_SEND_FAILED";
        console.error(
          `[SMS] Failed for ${student.phoneNumber || "NA"}. Message: "${message || "NA"}". Reason: ${reason}`
        );
        failed.push({
          studentId: student.id,
          channel,
          reason,
        });
      }
    }
  }
  return { sent, failed };
}

function normalizeIndianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    const error = new Error("INVALID_MOBILE_NUMBER");
    error.code = "INVALID_MOBILE_NUMBER";
    throw error;
  }
  return mobile;
}

async function sendSms(phoneNumber, message) {
  const url = new URL(process.env.SMS_API_URL);
  url.searchParams.set("apikey", process.env.SMS_API_KEY);
  url.searchParams.set("senderid", process.env.SMS_SENDER_ID);
  url.searchParams.set("type", process.env.SMS_TYPE);
  url.searchParams.set("mobile", normalizeIndianMobile(phoneNumber));
  url.searchParams.set("message", message);

  let response;
  try {
    response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15000) });
  } catch {
    const error = new Error("SMS_PROVIDER_UNAVAILABLE");
    error.code = "SMS_PROVIDER_UNAVAILABLE";
    throw error;
  }

  const result = (await response.text()).trim();
  let payloadRejected = false;
  try {
    const payload = JSON.parse(result);
    payloadRejected = payload.success === false || payload.status === false || ["error", "failed", "failure"].includes(String(payload.status).toLowerCase());
  } catch {
    // This gateway commonly returns a plain text result.
  }
  if (!response.ok || !result || payloadRejected || /^(ERR(?:OR)?|FAILED|FAIL|INVALID)\b/i.test(result)) {
    const error = new Error(`SMS_PROVIDER_REJECTED: ${result || `HTTP_${response.status}`}`);
    error.code = "SMS_PROVIDER_REJECTED";
    throw error;
  }
  return result;
}

async function listReminders(unpaidOnly) {
  const reminders = await prisma.reminder.findMany({
    orderBy: { id: "asc" },
    include: {
      student: {
        include: { feeAccounts: { include: { ledgerEntries: true } } },
      },
    },
  });
  const grouped = new Map();
  for (const reminder of reminders) {
    const current = grouped.get(reminder.studentId) || {
      studentId: reminder.student.id,
      registrationNumber: reminder.student.registrationNumber,
      name: reminder.student.name,
      duesOutstanding: duesOf(reminder.student),
      reminders: [],
    };
    current.reminders.push({
      id: reminder.id,
      channel: reminder.channel,
      sentAt: reminder.sentAt,
      actedBy: reminder.actedBy,
    });
    grouped.set(reminder.studentId, current);
  }
  const rows = [...grouped.values()];
  if (unpaidOnly) {
    return rows.filter((row) => row.duesOutstanding > 0);
  }
  return rows;
}

module.exports = {
  sendReminders,
  listReminders,
};
