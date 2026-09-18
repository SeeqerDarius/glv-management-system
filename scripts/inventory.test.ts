import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateStockToDemand } from "../lib/procurement";

type Unit = {
  productId: string;
  customerName: string;
  coveredByStock: boolean;
};

function units(...rows: Array<[string, string]>): Unit[] {
  return rows.map(([productId, customerName]) => ({
    productId,
    customerName,
    coveredByStock: false,
  }));
}

function covered(rows: Unit[]) {
  return rows.map((row) => row.coveredByStock);
}

test("units already in stock leave the buying list", () => {
  const rows = units(["fridge", "Ama"], ["fridge", "Kofi"], ["fridge", "Yaw"]);

  allocateStockToDemand(rows, new Map([["fridge", 2]]));

  assert.deepEqual(covered(rows), [true, true, false]);
});

test("a product with no stock is entirely still to buy", () => {
  const rows = units(["tv", "Ama"], ["tv", "Kofi"]);

  allocateStockToDemand(rows, new Map());

  assert.deepEqual(covered(rows), [false, false]);
});

test("stock beyond what is owed covers everything and nothing is bought", () => {
  const rows = units(["stove", "Ama"]);

  allocateStockToDemand(rows, new Map([["stove", 5]]));

  assert.deepEqual(covered(rows), [true]);
});

test("stock is reserved per product, never borrowed from another", () => {
  const rows = units(["fridge", "Ama"], ["tv", "Kofi"], ["fridge", "Yaw"]);

  allocateStockToDemand(rows, new Map([["fridge", 1]]));

  assert.deepEqual(covered(rows), [true, false, false]);
});

test("stock goes to the customers listed first, who are nearest completion", () => {
  // The caller sorts by progress descending, so position carries the priority.
  const rows = units(
    ["fridge", "Nearly done"],
    ["fridge", "Halfway"],
    ["fridge", "Just crossed"]
  );

  allocateStockToDemand(rows, new Map([["fridge", 1]]));

  assert.deepEqual(covered(rows), [true, false, false]);
  assert.equal(rows[0].customerName, "Nearly done");
});

test("allocation does not mutate the caller's stock figures", () => {
  const stock = new Map([["fridge", 2]]);

  allocateStockToDemand(units(["fridge", "Ama"], ["fridge", "Kofi"]), stock);

  assert.equal(stock.get("fridge"), 2);
});

test("a previously covered unit is re-evaluated, not left marked", () => {
  const rows = units(["fridge", "Ama"]);
  rows[0].coveredByStock = true;

  allocateStockToDemand(rows, new Map([["fridge", 0]]));

  assert.deepEqual(covered(rows), [false]);
});
