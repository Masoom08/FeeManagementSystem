require("./config/database-url");

const express = require("express");
const cors = require("cors");
const courseRoutes = require("./modules/course/course.routes");
const feeRoutes = require("./modules/fee/fee.routes");
const studentRoutes = require("./modules/student/student.routes");
const paymentRoutes = require("./modules/payment/payment.routes");
const reminderRoutes = require("./modules/reminder/reminder.routes");
const reportRoutes = require("./modules/report/report.routes");
const authRoutes = require("./modules/auth/auth.routes");
const studentAuthRoutes = require("./modules/student-auth/student-auth.routes");
const { authenticate } = require("./middleware/authenticate");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/student-auth", studentAuthRoutes);
app.use("/api", authenticate);
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: "ICCMRT Fee Management API",
      endpoints: [
        "/api/courses",
        "/api/academic-years",
        "/api/semesters",
        "/api/fee-structures",
        "/api/hostel-rates",
        "/api/fees",
        "/api/students",
        "/api/students/imports/preview",
        "/api/students/imports/:id/commit",
        "/api/student-auth/request-otp",
        "/api/student-auth/verify-otp",
        "/api/student-auth/me",
        "/api/student-auth/logout",
        "/api/student-auth/payments",
        "/api/student-auth/payments/:orderId/mock-success",
        "/api/student-auth/payments/:orderId/mock-failure",
        "/api/student-auth/receipts",
        "/api/payments",
        "/api/receipts",
        "/api/reminders",
        "/api/reports",
      ],
    },
  });
});
app.use("/api/courses", courseRoutes);
app.use("/api/academic-years", feeRoutes.academicYears);
app.use("/api/semesters", feeRoutes.semesters);
app.use("/api/fee-structures", feeRoutes.feeStructures);
app.use("/api/hostel-rates", feeRoutes.hostelRates);
app.use("/api/fees", feeRoutes.fees);
app.use("/api/students", studentRoutes);
app.use("/api/payments", paymentRoutes.payments);
app.use("/api/receipts", paymentRoutes.receipts);
app.use("/api/reminders", reminderRoutes);
app.use("/api/reports", reportRoutes);
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
  });
});
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
