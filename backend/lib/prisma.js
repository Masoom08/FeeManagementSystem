require("../config/database-url");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function transaction(work) {
  return prisma.$transaction(work, { maxWait: 15000, timeout: 20000 });
}

prisma.transaction = transaction;

module.exports = prisma;
