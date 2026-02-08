# Evaluation & Tracking (v1)

Planned metrics and checks to assess GoalFlow quality and reliability.

## Matching quality
- Dataset of tasks with expected best candidates.
- Track accuracy@1 / MRR on the set.
- Periodic regression test: run match use case with fixed seeds.

## Scheduling acceptance
- Measure acceptance rate for proposed slots.
- Track mean time-to-schedule and decline reasons (conflicts / capacity).

## Latency budgets
- API targets (p50/p95/p99):
  - `/api/match`: 150/300/600 ms
  - `/api/schedule/propose`: 180/350/700 ms
  - `/api/goals/*`: 120/250/500 ms
- Add simple histogram logging in future ops work.

## LLM cost tracking (future)
- Log prompt/completion tokens and approx USD per call (stub present in LLM adapter).
- Aggregate daily cost ceiling; alert if exceeded.

## Reliability checklist
- Health checks covered (`/api/health`).
- DB migrations applied before tests (CI uses Atlas).
- Add structured logs + metrics exporter in next iteration.

## Experiment playbook (outline)
1) Define hypothesis (e.g., new matching weights).
2) Run offline evaluation on dataset; record metrics.
3) Deploy behind flag; capture live acceptance/latency deltas.
4) Roll forward/back based on thresholds.
