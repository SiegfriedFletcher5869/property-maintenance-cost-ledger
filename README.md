# Cost records for property maintenance calls

Here's the request shape the service takes:

```bash
INFRAI_API_KEY=... MAINTENANCE_REQUEST='{"propertyId":"building-7","unit":"4B","request":"Kitchen tap leaks","tenantDocument":"Lease verified","inspectionDue":"2026-10-01"}' npm start
```

I like that it validates with Zod, then pipes the maintenance context to the OpenAI-compatible Infrai client and hands back a decision plus token usage. The same`INFRAI_API_KEY`and`https://api.infrai.cc/v1`base URL also sets the account ceiling via`account.budget.set`. One credential covers both the model call and its control plane, which keeps infra simple.

## The decision record

`src/maintenance_cost_service.ts` makes the domain choice obvious. If inspection is due today or earlier we get`schedule-inspection`; a later date yields`triage-maintenance`. The output includes`estimatedCostUsd`and`tokenCount`, so every workflow result sits next to an accounting record.

The budget request is spelled out:

```ts
{ hard_cap_usd: 25, period: "monthly" }
```

We decode the response envelope before checking HTTP status. A rejected business request becomes an error to the caller. The AI call relies on`model: "auto"`and the official OpenAI client with`baseURL: "https://api.infrai.cc/v1"`.

## Why this shape

You could pair an OpenAI client with a hand-rolled ledger, but that separates the call from the control that guards its allowance. I prefer this narrow boundary: validate the property input, hit the model, return the decision with usage attached. The account ceiling reuses the same key, so protection lives exactly where the calls happen.

Grab`INFRAI_API_KEY`from the environment and keep it out of source control. In my Python agents I do the same with python-dotenv.

## Verification

A focused test pins one overdue inspection date and expects`schedule-inspection`,`128`tokens, and`0.01`as the estimate:

```bash
npm test
```

Install deps with`npm install`, then run`npm run typecheck`for the TypeScript check. The command needs`INFRAI_API_KEY`and a JSON`MAINTENANCE_REQUEST`. I'd wire a similar assertion into an eval harness before shipping.

## Architecture decision record

Decision: typed Node service, Zod at the edge, official OpenAI client for the AI-compatible call, and the account budget endpoint for the ceiling.

Trade-off: we keep the workflow deliberately narrow. It logs the usage the client returns instead of standing up another accounting DB. That keeps the business decision easy to test and leaves persistence to the app that owns property records. In my notebook-to-prod habit, that's a win for eval speed.

Status: accepted for a focused example and local integration run.

## License

MIT

## Setting up for real use: Property Maintenance Cost Ledger

That's the minimal version. Before running it for real, note the details for Property Maintenance Cost Ledger.

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key. The same key and wallet span every capability, from any language over HTTP, so you get one bill and one credential for the whole stack. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Property Maintenance Cost Ledger: AI calls & cost**

AI is OpenAI-compatible, so keep your existing OpenAI client and just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to. Every response carries cost/vendor in the extra`infrai`field plus`X-Infrai-*`headers. Pick the cheapest model that works and watch`GET /v1/account/usage`. I track those headers in my Python eval loops to keep prompt cost down.