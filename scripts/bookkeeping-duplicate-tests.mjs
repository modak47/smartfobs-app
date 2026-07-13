import assert from "node:assert/strict";

function normaliseDescription(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value) {
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const uk = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  return raw;
}

function pence(value) {
  return Math.round(Number(String(value).replace(/[£,\s]/g, "")) * 100);
}

function direction(amountPence) {
  return amountPence > 0 ? "incoming" : amountPence < 0 ? "outgoing" : "zero";
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function base(row) {
  const amountPence = pence(row.amount);
  return `sf_base_${stableHash([
    parseDate(row.date),
    normaliseDescription(row.description),
    String(amountPence),
    direction(amountPence),
  ].join("|"))}`;
}

function importPlan(existingRows, incomingRows) {
  const existingCounts = existingRows.reduce((counts, row) => {
    const key = base(row);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const incomingCounts = {};
  return incomingRows.map((row) => {
    const key = base(row);
    const occurrence = (incomingCounts[key] || 0) + 1;
    incomingCounts[key] = occurrence;
    return { ...row, key, occurrence, insert: occurrence > (existingCounts[key] || 0) };
  });
}

const monthly = [
  { date: "14/04/2026", description: "Dobbies Garden CenBrighton", amount: "-27.98" },
  { date: "15/04/2026", description: "SHOPIFY INC", amount: "78.15" },
];
const fullHistorySameRows = [
  { date: "2026-04-14", description: "dobbies   garden cenbrighton", amount: "-27.98" },
  { date: "2026-04-15", description: "Shopify Inc", amount: "78.15" },
];

assert.deepEqual(importPlan([], monthly).map((row) => row.insert), [true, true], "first import inserts rows");
assert.deepEqual(importPlan(monthly, monthly).map((row) => row.insert), [false, false], "same file twice skips rows");
assert.deepEqual(importPlan(monthly, fullHistorySameRows).map((row) => row.insert), [false, false], "differently named overlapping file skips same rows");
assert.deepEqual(importPlan(fullHistorySameRows, monthly).map((row) => row.insert), [false, false], "monthly after full history skips same rows");
assert.equal(base({ date: "14/04/2026", description: "DOBBIES  Garden CenBrighton", amount: "-27.98" }), base({ date: "2026-04-14", description: "dobbies garden cenbrighton", amount: "-27.98" }), "case and whitespace normalise");
assert.equal(base({ date: "14/04/2026", description: "Dobbies", amount: "-27.98" }), base({ date: "2026-04-14", description: "Dobbies", amount: "-27.98" }), "UK and ISO dates match");
assert.notEqual(base({ date: "14/04/2026", description: "Dobbies", amount: "27.98" }), base({ date: "14/04/2026", description: "Dobbies", amount: "-27.98" }), "positive and negative same value differ");
assert.deepEqual(importPlan([{ date: "14/04/2026", description: "Dobbies", amount: "-27.98" }], [
  { date: "14/04/2026", description: "Dobbies", amount: "-27.98" },
  { date: "14/04/2026", description: "Dobbies", amount: "-27.98" },
]).map((row) => row.insert), [false, true], "genuine second identical occurrence can be inserted");
assert.deepEqual(importPlan([{ date: "14/04/2026", description: "Dobbies", amount: "-27.98", transaction_hash: null }], [
  { date: "2026-04-14", description: "Dobbies", amount: "-27.98" },
]).map((row) => row.insert), [false], "old null hash row still prevents duplicate");

const survivorPriority = [
  { id: "new-copy", reviewed: false, category: "Miscellaneous", notes: "" },
  { id: "old-reviewed", reviewed: true, category: "Parts", notes: "checked" },
].sort((a, b) =>
  Number(!a.reviewed) - Number(!b.reviewed) ||
  Number(a.category === "Miscellaneous") - Number(b.category === "Miscellaneous") ||
  Number(!a.notes) - Number(!b.notes)
);
assert.equal(survivorPriority[0].id, "old-reviewed", "cleanup preserves reviewed category and notes");

console.log("Bookkeeping duplicate tests passed");
