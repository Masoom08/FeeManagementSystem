const express = require("express");
const { validate } = require("../../middleware/validate");
const { requireSuperAdmin } = require("../../middleware/authenticate");
const controller = require("./batch.controller");
const { createBatchBody } = require("./batch.validation");

const router = express.Router();
router.get("/", controller.listBatches);
router.post("/", requireSuperAdmin, validate({ body: createBatchBody }), controller.createBatch);

module.exports = router;
