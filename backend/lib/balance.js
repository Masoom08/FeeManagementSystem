function isDepositMovement(entry) {
  return entry.bucket === "DEPOSIT" && entry.entryType !== "ASSESSMENT";
}

function balances(entries) {
  let duesOutstanding = 0;
  let depositHeld = 0;
  let depositAssessed = 0;
  let depositCollected = 0;

  for (const entry of entries) {
    const sign = entry.direction === "INCREASE" ? 1 : -1;
    if (entry.bucket === "DUES") {
      duesOutstanding += sign * entry.amount;
    }
    if (isDepositMovement(entry)) {
      depositHeld += sign * entry.amount;
    }
    if (entry.bucket === "DEPOSIT" && entry.entryType === "ASSESSMENT") {
      depositAssessed += entry.amount;
    }
    if (entry.bucket === "DEPOSIT" && entry.entryType === "PAYMENT" && entry.direction === "INCREASE") {
      depositCollected += entry.amount;
    }
  }

  return {
    duesOutstanding,
    depositHeld,
    depositOutstanding: Math.max(0, depositAssessed - depositCollected),
  };
}

function principalOutstanding(entries, semesterId) {
  let assessed = 0;
  let reduced = 0;
  for (const entry of entries) {
    if (entry.semesterId !== semesterId || entry.bucket !== "DUES") {
      continue;
    }
    if (entry.entryType === "ASSESSMENT" && entry.direction === "INCREASE") {
      assessed += entry.amount;
    }
    if (
      (entry.entryType === "PAYMENT" || entry.entryType === "ADJUSTMENT") &&
      entry.direction === "DECREASE"
    ) {
      reduced += entry.amount;
    }
  }
  return Math.max(0, assessed - reduced);
}

function postedFineTotal(entries, semesterId) {
  return entries
    .filter((entry) => entry.semesterId === semesterId && entry.entryType === "FINE")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function percent(part, whole) {
  if (!whole) {
    return 0;
  }
  return Math.round((part / whole) * 10000) / 100;
}

module.exports = {
  balances,
  principalOutstanding,
  postedFineTotal,
  percent,
};
