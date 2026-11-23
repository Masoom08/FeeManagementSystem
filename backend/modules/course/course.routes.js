const express = require("express");
const { validate } = require("../../middleware/validate");
const schemas = require("./course.validation");
const controller = require("./course.controller");
const { requireSuperAdmin } = require("../../middleware/authenticate");

const router = express.Router();

router.post("/", requireSuperAdmin, validate({ body: schemas.createCourseBody }), controller.createCourse);
router.get("/", controller.listCourses);
router.get("/:id", validate({ params: schemas.courseIdParams }), controller.getCourse);
router.patch(
  "/:id",
  requireSuperAdmin,
  validate({ params: schemas.courseIdParams, body: schemas.updateCourseBody }),
  controller.updateCourse
);
router.get(
  "/:id/delete-preview",
  requireSuperAdmin,
  validate({ params: schemas.courseIdParams }),
  controller.previewCourseDelete
);
router.delete(
  "/:id",
  requireSuperAdmin,
  validate({ params: schemas.courseIdParams }),
  controller.deleteCourse
);

module.exports = router;
