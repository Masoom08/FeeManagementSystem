const { SEMESTER_NAMES } = require("./terms");

function termOrder(name) {
  const value = String(name || "").trim().toLowerCase();
  if (value === "ist semester" || value === "odd" || value.startsWith("ist ")) return 0;
  if (value === "iind semester" || value === "even" || value.startsWith("iind ")) return 1;
  const index = SEMESTER_NAMES.indexOf(name);
  return index === -1 ? SEMESTER_NAMES.length : index;
}

function programSemesterNumber(studyYear, termName) {
  return (Math.max(1, studyYear) - 1) * 2 + (termOrder(termName) === 1 ? 2 : 1);
}

function yearTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

function orderedYears(years) {
  return [...years].sort((a, b) => yearTime(a.startDate) - yearTime(b.startDate) || String(a.label).localeCompare(String(b.label)));
}

function programSemesterForLine(student, years, semester) {
  // The current schema stores numbered semesters inside a Session. Older
  // records used a separate AcademicYear model and odd/even term names.
  const numberedSemester = String(semester?.name || "").match(/^semester\s+(\d+)$/i);
  if (numberedSemester) return Number(numberedSemester[1]);

  const ordered = orderedYears(years);
  const currentIndex = ordered.findIndex((item) => item.id === student.sessionId);
  const feeIndex = ordered.findIndex((item) => item.id === semester.sessionId);
  const studyYear = currentIndex >= 0 && feeIndex >= 0
    ? student.studyYear - (currentIndex - feeIndex)
    : student.studyYear;
  return programSemesterNumber(Math.max(1, studyYear), semester.name);
}

module.exports = {
  termOrder,
  programSemesterNumber,
  programSemesterForLine,
};
