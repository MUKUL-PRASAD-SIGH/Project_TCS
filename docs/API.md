# PermitAI phase 1 API

> **SYNTHETIC DEMO RULES — NOT GOVERNMENT REGULATIONS.**

The phase 1 service supports the Bengaluru demo jurisdiction and the `temporary_event` and `temporary_food_stall` permit types. It makes deterministic assessments from versioned JSON rules; it does not use an LLM.

## Run locally

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs`. The existing Vite origin, `http://localhost:5173`, is allowed by CORS by default.

## Endpoints

- `GET /api/health`
- `GET /api/permits`
- `POST /api/assess`

Example assessment request:

```json
{
  "location": {
    "country": "India",
    "state": "Karnataka",
    "city": "Bengaluru"
  },
  "permit_type": "temporary_event",
  "applicant": {
    "answers": {
      "event_duration_days": 2,
      "expected_attendance": 100,
      "emergency_plan_provided": true,
      "uses_amplified_sound": false
    }
  }
}
```

The response contains an overall assessment status, a rule-set version, and one result per configured rule. A missing answer produces `UNKNOWN`; it is never treated as `false`. An empty rule set produces `NEEDS_VERIFICATION`, never an eligible result.
