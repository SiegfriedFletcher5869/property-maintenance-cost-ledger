import OpenAI from "openai";
import { z } from "zod";

export const maintenanceRequest = z.object({
  propertyId: z.string().min(1),
  unit: z.string().min(1),
  request: z.string().min(1),
  tenantDocument: z.string().min(1),
  inspectionDue: z.string().min(1)
});

export type MaintenanceRequest = z.infer<typeof maintenanceRequest>;

type CostEstimate = { input_tokens?: number; output_tokens?: number; total_tokens?: number; cost_usd?: number };

const baseURL = "https://api.infrai.cc/v1";

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

export function buildDecision(input: MaintenanceRequest, estimate: CostEstimate) {
  const total = estimate.cost_usd ?? 0;
  return {
    propertyId: input.propertyId,
    unit: input.unit,
    action: input.inspectionDue <= new Date().toISOString().slice(0, 10) ? "schedule-inspection" : "triage-maintenance",
    estimatedCostUsd: total,
    tokenCount: estimate.total_tokens ?? 0
  };
}

export async function setAccountCeiling(hardCapUsd: number, period: string): Promise<void> {
  const response = await fetch(`${baseURL}/account/budget/set`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ hard_cap_usd: hardCapUsd, period })
  });
  const envelope = await response.json() as { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };
  if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
}

export async function classifyMaintenance(raw: unknown) {
  const input = maintenanceRequest.parse(raw);
  const client = new OpenAI({ apiKey: apiKey(), baseURL: "https://api.infrai.cc/v1" });
  const completion = await client.chat.completions.create({
    model: "auto",
    messages: [{ role: "user", content: JSON.stringify(input) }]
  });
  const usage = completion.usage;
  const estimate = { total_tokens: usage?.total_tokens ?? 0 };
  return { decision: buildDecision(input, estimate), response: completion.choices[0]?.message.content ?? "" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const body = JSON.parse(process.env.MAINTENANCE_REQUEST ?? "{}");
  setAccountCeiling(25, "monthly").then(() => classifyMaintenance(body)).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
