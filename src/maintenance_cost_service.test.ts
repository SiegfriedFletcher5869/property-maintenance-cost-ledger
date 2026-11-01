import { strict as assert } from "node:assert";
import { buildDecision, maintenanceRequest } from "./maintenance_cost_service.ts";

const input = {
  propertyId: "building-7",
  unit: "4B",
  request: "Kitchen tap leaks",
  tenantDocument: "Lease verified",
  inspectionDue: "2026-10-01"
};

const parsed = maintenanceRequest.parse(input);
const result = buildDecision(parsed, { total_tokens: 128, cost_usd: 0.01 });
assert.equal(result.action, "schedule-inspection");
assert.equal(result.tokenCount, 128);
assert.equal(result.estimatedCostUsd, 0.01);
console.log("maintenance decision and cost record: ok");
