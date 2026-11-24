const { asyncRoute } = require("../../lib/asyncRoute");
const service = require("./batch.service");

const listBatches = asyncRoute(async (req, res) => {
  res.status(200).json({ success: true, data: await service.listBatches() });
});
const createBatch = asyncRoute(async (req, res) => {
  res.status(201).json({ success: true, data: await service.createBatch(req.body) });
});

module.exports = { listBatches, createBatch };
