# GeoProspectorAI — Harness Engineering Implementation Reference

**Scope:** Concise implementation reference for the five harness engineering patterns identified from the CloudYeti field notes series, applied to GeoProspectorAI's self-improving ML pipeline. **Companion documents:** Self-Improving Model Guide v2.0 · Security Guide v1.0 · DEPLOY.md **Last updated:** October 2026

## Quick Reference Map

| Pattern | Core Idea | GeoProspectorAI Location |
| --- | --- | --- |
| [1. Design the Environment](#1-design-the-environment) | Model + 5 components = harness | `ml/harness/` directory |
| [2. Move Memory Into the Repo](#2-move-memory-into-the-repo) | Chat is temporary; repo is durable | `ml/agent_state/` directory |
| [3. Policy Gates](#3-policy-gates) | STOP before every destructive action | `@policy_gate` decorator |
| [4. Use Every Miss as Evidence](#4-use-every-miss-as-evidence) | Failures are harness specs | `ml/agent_state/gotchas/` |
| [5. Make the Result Visible](#5-make-the-result-visible) | Agent must observe real outcomes | Evaluator → Evolution context loop |

## 1\. Design the Environment

_"Design the environment the agent works in."_ The model alone is not the agent. The harness is everything else.

### The Five Components

```text
                    ┌─────────────┐
                    │ INSTRUCTIONS│  ← system_prompt.txt (version-controlled)
                    └──────┬──────┘
          ┌─────────┐      │      ┌────────┐
          │  TOOLS  │──────┼──────│  STATE │
          └─────────┘      │      └────────┘
                    ┌──────┴──────┐
          ┌─────────┤    MODEL    ├──────────┐
          │  SKILLS │             │  CHECKS  │
          └─────────┘             └──────────┘
```

### GeoProspectorAI Component Registry

Create ml/harness/registry.py — the single source of truth for what each agent can do:

```python
# ml/harness/registry.py

EVOLUTION_AGENT_HARNESS = {

    # ── INSTRUCTIONS ──────────────────────────────────────────
    "system_prompt": "ml/harness/prompts/evolution_prompt.txt",
    "prompt_version": "1.2",   # bump on every prompt change

    # ── TOOLS (functions the agent can request be called) ─────
    "tools": [
        "load_decision_log",        # read prior evolution history
        "read_evaluator_report",    # read latest ground-truth reconciliation
        "propose_harness_change",   # write a proposal to evolution_proposals table
        "read_feature_importances", # read RF feature importance from last model
    ],
    # Tools the Evolution Agent must NEVER have:
    "prohibited_tools": [
        "execute_code",             # LLM05 — no auto-execution
        "write_model_artifact",     # LLM06 — no direct model writes
        "update_active_secret",     # LLM06 — no secret updates
        "delete_training_data",     # LLM04 — no dataset mutation
    ],

    # ── SKILLS (reusable domain functions the harness provides) ─
    "skills": [
        "classify_failure_pattern", # map error to category (miss/false-alarm/drift)
        "consult_blueprint",        # look up province-specific strategy from Meta-Evolution
        "load_gotchas",             # load known failure patterns from gotchas/ directory
    ],

    # ── STATE (what the agent knows at invocation time) ────────
    "state_inputs": [
        "InferenceTrace",           # from Worker Agent
        "EvaluatorReport",          # from Evaluator Agent
        "decision_log.yaml",        # full evolution history from repo
        "best_harness_snapshot",    # best-performing harness config so far
        "blueprint_registry",       # Meta-Evolution province strategy registry
    ],

    # ── CHECKS (gates that run before agent output is accepted) ─
    "output_checks": [
        "validate_proposal_schema", # output must match EvolutionProposal JSON schema
        "ast_gate",                 # no exec/eval/import in any proposed code
        "no_prohibited_tool_calls", # output must not request prohibited tools
        "prompt_leakage_check",     # output must not contain system prompt content
    ],
}
```

### Loader — always validate the harness on startup

```python
# ml/harness/loader.py

import json
from pathlib import Path

def load_and_validate_harness(agent_name: str) -> dict:
    """Load harness config and verify all referenced files exist."""
    harness = EVOLUTION_AGENT_HARNESS  # or fetch by agent_name
    prompt_path = Path(harness["system_prompt"])
    assert prompt_path.exists(), f"Missing prompt: {prompt_path}"
    assert prompt_path.stat().st_size > 0,  "Empty prompt file"
    return harness
```

## 2\. Move Memory Into the Repo

_"When the agent forgets a decision — move memory out of chat and into the repo."_ Chat sessions fade. Repository files persist across every session, deployment, and model version.

### Directory Structure

```text
GeoProspectorAI/
└── ml/
    └── agent_state/
        ├── progress.md          # current evolution status — updated each cycle
        ├── decision-log.yaml    # every proposed change + outcome, append-only
        └── gotchas/
            ├── README.md        # how to add a gotcha
            ├── bushveld_pge.md  # Bushveld Complex PGM-specific failure patterns
            ├── witwatersrand_au.md
            └── general.md      # cross-region patterns
```

### progress.md — current state snapshot

```text
# GeoProspectorAI Evolution Progress

**Current model version:** v2.3.d14
**Evolution step:** 11
**Last retrain:** 2026-10-08
**Status:** STABLE — awaiting next field observation batch

## Active Hypotheses
- Increasing borehole sample weight in Bushveld reduced miss rate by 0.04
- ERT_RESISTIVITY feature shows low importance in dry-season imagery — investigate

## Next Planned Step
- Tighten High-zone buffer from 500 m → 400 m in Bushveld PGE target areas
- Pending: field observations from client BHF-2026-11 batch (expected Oct 20)

## Blocked On
- SAMINDABA SAMINDABA Q4 update not yet available — defer zinc/lead model expansion
```

### decision-log.yaml — append-only evolution history

```yaml
# APPEND ONLY — never edit or delete existing entries
# Each entry is written by the Evolution Agent + confirmed by analyst approval

- step: 1
  date: 2026-08-14
  base_version: v2.0.d1
  proposed_change: increase_n_estimators
  params: {n_estimators: 300 → 400}
  rationale: "False alarm rate 0.21 — expected more trees to smooth boundaries"
  quality_gates: {f1: 0.81, recall_high: 0.76, false_alarm: 0.19}
  outcome: IMPROVED
  promoted_to: v2.1.d2
  analyst: ramsey@mandlakazi.co.za

- step: 2
  date: 2026-08-28
  base_version: v2.1.d2
  proposed_change: reduce_high_zone_buffer
  params: {high_zone_buffer_m: 500 → 400}
  rationale: "Miss rate 0.22 in Bushveld — buffer too wide, including non-mineralised ground"
  quality_gates: {f1: 0.79, recall_high: 0.70, false_alarm: 0.17}
  outcome: REGRESSED
  promoted_to: null
  note: "DO NOT RETRY — tighter buffer hurts recall more than it helps precision"

- step: 3
  date: 2026-09-05
  base_version: v2.1.d2
  proposed_change: upweight_geophysical_samples
  params: {geophys_sample_weight_multiplier: 1.0 → 1.5}
  rationale: "MAG_RTP dominant error feature — geophysically-surveyed samples underrepresented"
  quality_gates: {f1: 0.84, recall_high: 0.78, false_alarm: 0.14}
  outcome: IMPROVED
  promoted_to: v2.2.d6
  analyst: ramsey@mandlakazi.co.za
```

### Reading the decision log in the Evolution Agent

```python
# ml/services/evolution_agent.py

import yaml
from pathlib import Path

def load_decision_log() -> list[dict]:
    """Load full evolution history. Always read before proposing a change."""
    path = Path("ml/agent_state/decision-log.yaml")
    if not path.exists():
        return []
    return yaml.safe_load(path.read_text()) or []

def get_failed_strategies() -> set[str]:
    """Return the set of changes that have been tried and regressed."""
    log = load_decision_log()
    return {
        entry["proposed_change"]
        for entry in log
        if entry.get("outcome") == "REGRESSED"
    }

class EvolutionAgent:
    def evolve(self, history, best_harness):
        failed = get_failed_strategies()
        gotchas = load_gotchas()              # see Pattern 4
        last_eval = history[-1] if history else None

        context = self._build_context(
            last_eval, best_harness, failed, gotchas
        )
        # Pass full context to LLM — never a blank slate
        return self._call_llm(context)

    def _build_context(self, eval_report, harness, failed, gotchas):
        return f"""
CURRENT HARNESS: {json.dumps(harness, indent=2)}

LAST OBSERVED OUTCOME (real field data — not predicted):
  miss_rate:              {eval_report.miss_rate if eval_report else 'N/A'}
  false_alarm_rate:       {eval_report.false_alarm_rate if eval_report else 'N/A'}
  dominant_error_feature: {eval_report.dominant_error_feature if eval_report else 'N/A'}
  verdict:                {eval_report.verdict if eval_report else 'N/A'}

PREVIOUSLY TRIED AND FAILED (do not repeat these):
{chr(10).join(f'  - {s}' for s in failed) or '  none yet'}

KNOWN GOTCHAS FOR THIS REGION:
{gotchas}

OUTPUT: A single JSON object matching the EvolutionProposal schema.
Do not propose any change listed under PREVIOUSLY TRIED AND FAILED.
"""
```

### Writing a new log entry after approval

```python
def append_decision_log(entry: dict) -> None:
    """Append a new entry. Called by the approval service after analyst sign-off."""
    path = Path("ml/agent_state/decision-log.yaml")
    existing = yaml.safe_load(path.read_text()) or [] if path.exists() else []
    existing.append(entry)
    path.write_text(yaml.dump(existing, sort_keys=False, allow_unicode=True))
    # Commit to Git so history is durable
    subprocess.run(["git", "add", str(path)], check=True)
    subprocess.run(["git", "commit", "-m",
        f"chore(evolution): step {entry['step']} — {entry['proposed_change']}"],
        check=True)
```

## 3\. Policy Gates

_"Destructive change detected. Sensor: compare planned state. Action: STOP + review."_ Before any irreversible action, compare planned state to current state and block automatically.

### The Decorator

```python
# ml/harness/policy_gate.py

import functools
from typing import Callable
from api.db import audit_log

class PolicyGateException(Exception):
    """Raised when a policy gate blocks an action."""
    pass

def policy_gate(check_fn: Callable, label: str = ""):
    """
    Decorator that runs check_fn(*args, **kwargs) before the wrapped function.
    If check_fn returns a non-empty string, the action is BLOCKED and logged.

    Usage:
        @policy_gate(check_fn=detect_schema_change, label="SCHEMA_CHANGE")
        def promote_model(proposal_id, analyst_id, comment):
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            violation = check_fn(*args, **kwargs)
            if violation:
                gate_label = label or func.__name__.upper()
                audit_log.append("POLICY_GATE_BLOCKED", {
                    "gate":     gate_label,
                    "function": func.__name__,
                    "reason":   violation,
                    "action":   "stop+review",
                })
                raise PolicyGateException(
                    f"BLOCKED [{gate_label}]: {violation}"
                )
            return func(*args, **kwargs)
        return wrapper
    return decorator
```

### Gate Registry — all policy gates in one place

```python
# ml/harness/gates.py

import numpy as np

# ── CHECK FUNCTIONS ───────────────────────────────────────────────────────────

def detect_schema_change(proposal: dict, *args, **kwargs) -> str:
    """Block if proposal removes or reorders features from the schema."""
    current = FEATURE_SCHEMA_V2
    proposed = proposal.get("feature_schema", current)
    if set(proposed) != set(current):
        removed = set(current) - set(proposed)
        return f"Schema change detected — removed features: {removed}"
    return ""   # empty string = no violation = allow

def detect_recall_regression(model, X_val, y_val, *args, **kwargs) -> str:
    """Block if High-class recall drops below minimum threshold."""
    y_pred = model.predict(X_val)
    recall = np.sum((y_val == 2) & (y_pred == 2)) / max(1, np.sum(y_val == 2))
    if recall < 0.75:
        return f"High-class recall {recall:.3f} below minimum 0.75"
    return ""

def detect_class_balance_shift(new_observations: list, *args, **kwargs) -> str:
    """Block if new observations would shift class balance by more than 20%."""
    current_balance = db.get_class_balance()
    new_high = sum(1 for o in new_observations if o.observed_class == 2)
    new_total = len(new_observations)
    if new_total == 0:
        return ""
    shift = abs(new_high / new_total - current_balance["high_pct"])
    if shift > 0.20:
        return f"Class balance shift {shift:.1%} exceeds 20% threshold — possible poisoning"
    return ""

def detect_destructive_terraform_change(plan_output: str, *args, **kwargs) -> str:
    """Block Cloud Run deploys that would destroy persistent resources."""
    destructive_keywords = ["will be destroyed", "forces replacement", "deleted"]
    for kw in destructive_keywords:
        if kw in plan_output.lower():
            return f"Destructive infrastructure change: '{kw}' found in plan"
    return ""

def detect_multi_feature_drift(drift_report: dict, *args, **kwargs) -> str:
    """Block inference if more than 3 features are simultaneously drifting."""
    flagged = [f for f, v in drift_report.items()
               if isinstance(v, dict) and v.get("flag")]
    if len(flagged) >= 3:
        return f"Multi-feature drift: {flagged} — AOI outside training domain"
    return ""

# ── DECORATED FUNCTIONS ───────────────────────────────────────────────────────

@policy_gate(detect_schema_change,           label="SCHEMA_CHANGE")
def promote_model_with_schema_change(proposal_id, analyst_id, comment):
    ...

@policy_gate(detect_recall_regression,       label="RECALL_REGRESSION")
def execute_retraining(proposal, base_dataset_path, new_observations, prev_model):
    ...

@policy_gate(detect_class_balance_shift,     label="POISONING_RISK")
def ingest_observation_batch(observations, job):
    ...

@policy_gate(detect_multi_feature_drift,     label="OUT_OF_DOMAIN")
def run_inference_job(job_id, feature_tif, model):
    ...
```

### Gate Response — what happens after a BLOCK

```python
# ml/harness/gate_recovery.py

GATE_RECOVERY_ACTIONS = {
    "SCHEMA_CHANGE":    "notify_analyst + require_major_version_bump",
    "RECALL_REGRESSION":"reject_proposal + log_to_decision_log + suggest_alternative",
    "POISONING_RISK":   "quarantine_batch + alert_security + pause_retraining",
    "OUT_OF_DOMAIN":    "flag_job_for_manual_review + add_low_confidence_overlay",
    "RECALL_REGRESSION":"block_deploy + open_github_issue",
}

def handle_gate_block(exception: PolicyGateException) -> dict:
    gate = exception.args[0].split("[")[1].split("]")[0]
    action = GATE_RECOVERY_ACTIONS.get(gate, "notify_analyst")
    return {
        "status":  "BLOCKED",
        "gate":    gate,
        "action":  action,
        "message": str(exception),
    }
```

## 4\. Use Every Miss as Evidence

_"Use every miss as evidence — what was missing from the harness?"_ Every policy gate fire, every quality gate failure, every field observation contradiction is a specification for a missing harness component. Document it.

### The Four Diagnostic Questions

After every STOP event, run this four-question diagnostic and write the answer to gotchas/:

```text
1. STATE?    — Did the agent have the context it needed?
2. CHECKS?   — Was there a gate that should have caught this earlier?
3. RECOVERY? — Can the system return to a safe state automatically?
4. AUTHORITY? — Did the agent have permissions it should not have had?
```

### gotchas/ — format and example

```markdown
<!-- ml/agent_state/gotchas/bushveld_pge.md -->

# Gotchas — Bushveld Complex PGM Targeting

## GOTCHA-001  Reducing High-zone buffer hurts recall more than it helps precision
- **Discovered:** Evolution step 2, 2026-08-28
- **Gate fired:** RECALL_REGRESSION (recall dropped to 0.70)
- **Root cause (STATE):** Evolution Agent did not have access to the
  density distribution of PGM occurrences — assumed they were point sources,
  not reef-like elongated bodies up to 800 m wide.
- **Fix applied:** Added `reef_geometry_prior` field to province blueprint.
  Buffer reduction is prohibited for reef-hosted commodities.
- **Harness change:** Added `commodity_geometry_type` to STATE inputs.
  Added `detect_reef_buffer_reduction` check function to gate registry.

## GOTCHA-002  MAG_RTP nodata zones produce false High classifications
- **Discovered:** Evaluator report job-0042, 2026-09-12
- **Gate fired:** None — slipped through (CHECKS gap identified)
- **Root cause (CHECKS):** No gate checks for MAG_RTP nodata coverage
  before inference. When coverage < 60%, the imputer fills with mean,
  which happens to match mafic signature in Bushveld.
- **Fix applied:** Added `detect_geophys_coverage_gap` gate to
  `run_inference_job`. Inference now adds warning overlay when
  MAG_RTP coverage < 60% in the AOI.
- **Harness change:** New check function in `gates.py`. New field
  `mag_coverage_pct` added to InferenceTrace.
```

### Adding a gotcha programmatically

```python
# ml/harness/gotchas.py

from pathlib import Path
from datetime import date
import yaml

def load_gotchas(province: str = "general") -> str:
    """Load known failure patterns for a geological province."""
    path = Path(f"ml/agent_state/gotchas/{province}.md")
    if not path.exists():
        path = Path("ml/agent_state/gotchas/general.md")
    return path.read_text() if path.exists() else "No gotchas recorded yet."

def add_gotcha(province: str, title: str, gate_fired: str,
               state_gap: str, checks_gap: str,
               recovery: str, authority_gap: str,
               fix_applied: str, harness_change: str) -> None:
    """Write a new gotcha entry. Called after every policy gate post-mortem."""
    path = Path(f"ml/agent_state/gotchas/{province}.md")
    existing = path.read_text() if path.exists() else f"# Gotchas — {province}\n\n"

    # Count existing gotchas to assign ID
    count = existing.count("## GOTCHA-") + 1
    entry = f"""
## GOTCHA-{count:03d}  {title}
- **Discovered:** {date.today().isoformat()}
- **Gate fired:** {gate_fired}
- **Root cause (STATE):** {state_gap}
- **Root cause (CHECKS):** {checks_gap}
- **Recovery:** {recovery}
- **Authority gap:** {authority_gap}
- **Fix applied:** {fix_applied}
- **Harness change:** {harness_change}
"""
    path.write_text(existing + entry)
    subprocess.run(["git", "add", str(path)], check=True)
    subprocess.run(["git", "commit", "-m",
        f"docs(gotchas): GOTCHA-{count:03d} — {title[:50]}"], check=True)
```

## 5\. Make the Result Visible

_"When done is not actually done — make the result visible to the agent."_ The agent must observe the actual state of the world after it acts — not assume its action succeeded. Tools: Browser → Screenshot → Logs → Verify. Keep checking until it **actually works**.

### The Verification Chain

```text
Agent acts → Run verifiers → Feed real result back into agent context
                ↓
    ┌───────────────────────────┐
    │  1. BROWSER  — did the    │  Cloud Run /health endpoint returns 200?
    │     service start?        │
    ├───────────────────────────┤
    │  2. SCREENSHOT — does     │  Render a test AOI prospectivity map.
    │     output look correct?  │  Compare with reference fixture.
    ├───────────────────────────┤
    │  3. LOGS — any errors     │  Cloud Logging: ERROR or CRITICAL in
    │     in the real run?      │  last 10 minutes post-deploy.
    ├───────────────────────────┤
    │  4. VERIFY — did quality  │  Run quality gates on held-out
    │     actually improve?     │  validation set. Compare to baseline.
    └───────────────────────────┘
```

### Verification service

```python
# ml/harness/verifier.py

import httpx
import subprocess
from dataclasses import dataclass

@dataclass
class VerificationResult:
    browser_ok:    bool
    screenshot_ok: bool
    logs_clean:    bool
    quality_ok:    bool
    summary:       str

    @property
    def passed(self) -> bool:
        return all([self.browser_ok, self.screenshot_ok,
                    self.logs_clean, self.quality_ok])

def verify_deployment(service_url: str, model_version: str,
                       X_val, y_val) -> VerificationResult:
    """
    Run the full four-step verification chain after every model promotion.
    Feed the result back into the Evolution Agent's context next cycle.
    """
    # 1. BROWSER — health check
    try:
        resp = httpx.get(f"{service_url}/health", timeout=10)
        browser_ok = resp.status_code == 200 and \
                     resp.json().get("model_version") == model_version
    except Exception:
        browser_ok = False

    # 2. SCREENSHOT — render test AOI and compare to reference
    screenshot_ok = _compare_test_render(service_url)

    # 3. LOGS — check Cloud Logging for errors post-deploy
    logs_clean = _check_cloud_logs_clean(service_name="GeoProspectorAI-ml",
                                          lookback_minutes=10)

    # 4. VERIFY — run quality gates on validation set
    model  = load_active_model()
    gates  = run_quality_gates(model, X_val, y_val)
    quality_ok = all(gates.values())

    summary = (
        f"browser={'OK' if browser_ok else 'FAIL'} | "
        f"screenshot={'OK' if screenshot_ok else 'FAIL'} | "
        f"logs={'CLEAN' if logs_clean else 'ERRORS'} | "
        f"quality={'PASS' if quality_ok else 'FAIL'}"
    )

    return VerificationResult(
        browser_ok, screenshot_ok, logs_clean, quality_ok, summary
    )

def _check_cloud_logs_clean(service_name: str, lookback_minutes: int) -> bool:
    """Query Cloud Logging for CRITICAL/ERROR entries post-deploy."""
    result = subprocess.run([
        "gcloud", "logging", "read",
        f'resource.type=cloud_run_revision AND '
        f'resource.labels.service_name={service_name} AND '
        f'severity>=ERROR',
        f"--freshness={lookback_minutes}m",
        "--limit=1", "--format=value(severity)"
    ], capture_output=True, text=True)
    return result.stdout.strip() == ""   # empty = no errors
```

### Feeding verification back into the Evolution Agent

```python
# ml/services/evolution_agent.py  (addition to _build_context)

def build_full_context(eval_report, harness, failed,
                        gotchas, verification: VerificationResult) -> str:
    """
    Build the complete context the Evolution Agent receives.
    Includes ACTUAL observed outcomes — not just what was predicted.
    This is 'making the result visible'.
    """
    return f"""
═══════════════════════════════════════════════════════
LAST DEPLOYMENT — ACTUAL VERIFIED RESULT
  Verification summary: {verification.summary}
  Browser health:       {'✓' if verification.browser_ok    else '✗'}
  Test render match:    {'✓' if verification.screenshot_ok  else '✗'}
  Logs clean (10 min):  {'✓' if verification.logs_clean     else '✗'}
  Quality gates passed: {'✓' if verification.quality_ok     else '✗'}

FIELD-VALIDATED QUALITY (real observations, not held-out test set):
  Miss rate:              {eval_report.miss_rate:.3f}
  False alarm rate:       {eval_report.false_alarm_rate:.3f}
  Calibration error:      {eval_report.calibration_error:.3f}
  Dominant error feature: {eval_report.dominant_error_feature}
  Verdict vs. baseline:   {eval_report.verdict}

STRATEGIES ALREADY TRIED AND FAILED (do not repeat):
{chr(10).join(f'  ✗ {s}' for s in failed) or '  none yet'}

KNOWN GOTCHAS FOR THIS REGION:
{gotchas}

CURRENT BEST HARNESS:
{json.dumps(harness, indent=2)}
═══════════════════════════════════════════════════════

Given all of the above, propose ONE harness change as a JSON
EvolutionProposal. It must not repeat a failed strategy.
It must address the dominant error feature or the lowest-passing
quality gate. Explain your reasoning in the 'rationale' field.
"""
```

## Complete Cycle — How the Five Patterns Work Together

```text
┌─────────────────────────────────────────────────────────────────┐
│                    GEOPROSPECTORAI EVOLUTION CYCLE                    │
└─────────────────────────────────────────────────────────────────┘

    PATTERN 1                    PATTERN 2
 ┌────────────┐              ┌───────────────────────────┐
 │  HARNESS   │              │   REPO MEMORY             │
 │  REGISTRY  │              │   progress.md             │
 │            │   loads →    │   decision-log.yaml       │
 │ Instructions│              │   gotchas/                │
 │ Tools      │              └──────────────┬────────────┘
 │ Skills     │                             │ read by
 │ State      │                             ↓
 │ Checks     │         ┌──────────────────────────────┐
 └────────────┘         │      EVOLUTION AGENT         │
                        │                              │
                        │  _build_context():           │
                        │  • last eval report    ←── PATTERN 5
                        │  • failed strategies         │  (real result
                        │  • gotchas                   │   made visible)
                        │  • verification result       │
                        └──────────────┬───────────────┘
                                       │ proposes
                                       ↓
                        ┌──────────────────────────────┐
                        │    EVOLUTION PROPOSAL        │
                        │    (status: pending)         │
                        └──────────────┬───────────────┘
                                       │
                         PATTERN 3     │
                        ┌──────────────▼───────────────┐
                        │      POLICY GATES            │
                        │                              │
                        │  @policy_gate checks:        │
                        │  • schema change?    → BLOCK │
                        │  • recall regression?→ BLOCK │
                        │  • poisoning risk?   → BLOCK │
                        └──────────────┬───────────────┘
                                       │ passes
                                       ↓
                        ┌──────────────────────────────┐
                        │   HUMAN ANALYST APPROVAL     │
                        │   (approval UI + audit log)  │
                        └──────────────┬───────────────┘
                                       │ approved
                                       ↓
                        ┌──────────────────────────────┐
                        │   RETRAINING EXECUTOR        │
                        └──────────────┬───────────────┘
                                       │
                         PATTERN 5     │
                        ┌──────────────▼───────────────┐
                        │   VERIFIER                   │
                        │   browser → screenshot →     │
                        │   logs → verify              │
                        └──────────────┬───────────────┘
                                       │ result
                         PATTERN 4     ↓
                        ┌──────────────────────────────┐
                        │  GATE FIRED?                 │
                        │  → run 4-question diagnostic │
                        │  → write to gotchas/         │
                        │  → add new check to gates.py │
                        └──────────────┬───────────────┘
                                       │
                                       └──→  append decision-log.yaml
                                             update progress.md
                                             commit to GitHub
                                             ↑
                                       next cycle reads all of this
```

## File Checklist

All files below must exist in the repository before the first evolution cycle runs:

```text
[ ] ml/harness/registry.py           # component registry
[ ] ml/harness/loader.py             # harness validator
[ ] ml/harness/policy_gate.py        # @policy_gate decorator
[ ] ml/harness/gates.py              # all check functions + decorated wrappers
[ ] ml/harness/gate_recovery.py      # recovery action map
[ ] ml/harness/verifier.py           # 4-step verification chain
[ ] ml/harness/gotchas.py            # load_gotchas() + add_gotcha()
[ ] ml/harness/prompts/
[ ]     evolution_prompt.txt         # Evolution Agent system prompt
[ ]     evaluator_prompt.txt         # Evaluator Agent system prompt
[ ] ml/agent_state/progress.md       # current evolution status
[ ] ml/agent_state/decision-log.yaml # append-only history (start: empty list [])
[ ] ml/agent_state/gotchas/
[ ]     README.md
[ ]     general.md
[ ]     bushveld_pge.md              # create one per geological province as needed
```

_Source concepts: CloudYeti Harness / Field Notes series (YouTube Shorts)._ _Formal framework: Seong et al. (2026) "The Last Harness You'll Ever Build", Sylph.AI._ _Application: GeoProspectorAI Self-Improving Model Guide v2.0, Mandlakazi Mining Holdings (Pty) Ltd._
