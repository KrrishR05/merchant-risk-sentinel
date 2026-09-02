# RiskSūtra — AI Judgment Policy

## Core Principle

> **Deterministic where deterministic is better. AI where AI genuinely adds value.**

## Why We Do NOT Use an LLM For:

### Behavioral Scoring
Statistical baselines require reproducibility. Given the same merchant history, the same baseline must always result. LLMs are non-deterministic by nature and cannot guarantee identical numerical outputs across runs.

### Baseline Calculation
Rolling statistics, z-scores, and quantile computations are exact mathematical operations. An LLM adds latency, cost, and unpredictability with zero benefit over pandas/numpy.

### Anomaly Detection
Detection must be measurable with precision, recall, and F1 on held-out test sets. LLM outputs cannot be reliably evaluated with standard ML metrics because they lack numerical stability.

### Raw Risk Scoring
Risk scores drive automated defensive actions (step-up verification, human escalation). These scores must be reproducible, auditable, and testable. An LLM-generated score is none of these.

## Where AI Genuinely Adds Value (Day 3):

### Evidence Synthesis
Given structured signals from deterministic systems, an LLM can correlate heterogeneous evidence into a coherent narrative that a human analyst can quickly understand.

### Incident Investigation
An LLM with structured tool access can investigate correlated evidence, compare against baselines, and produce a bounded investigation report.

### Attack Narrative Reconstruction
Explaining *why* a sequence of events looks like an ATO requires natural language generation that deterministic systems cannot produce.

### Defensive Recommendations
Bounded, policy-constrained recommendations benefit from the LLM's ability to contextualize evidence.

## Guardrails

1. The LLM will NOT invent evidence
2. The LLM will NOT determine numeric risk scores
3. The LLM will NOT bypass policy/guardrails
4. The LLM will NOT execute offensive actions
5. All LLM outputs will be bounded by a deterministic policy layer
6. LLM unavailability will trigger a structured fallback (deterministic evidence summary)
