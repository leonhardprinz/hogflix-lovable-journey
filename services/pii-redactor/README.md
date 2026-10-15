# pii-redactor

Scrubs PII from `$ai_input` / `$ai_output_choices` before the event leaves the
backend. Presidio (pattern recognizers, scoring, anonymizer) with GLiNER as the
name and address model. Nothing is sent anywhere; the models run locally.

```bash
cd services/pii-redactor
uv venv --python 3.12 .venv && . .venv/bin/activate
uv pip install -r requirements.txt
pytest -q                      # 5 tests on real FlixBuddy traces
uvicorn app:app --port 8787    # first start downloads the GLiNER model (~1 GB)
```

Wire-up: set `PII_REDACTION_URL=http://host:8787` on the Supabase function
(`npx supabase secrets set PII_REDACTION_URL=...`) together with
`REDACT_LLM_CONTENT=true`. If the service is down the function falls back to
the regex scrubber in `_shared/pii-redactor.ts`, and the event carries
`$ai_redaction_engine` so you can tell which one ran.

Response shape:

```json
{"messages":[{"role":"user","content":"I am <PERSON>, mail me at <EMAIL_ADDRESS>"}],
 "entities":[{"text":"Leo Prinz","type":"PERSON","score":1.0,"start":5,"end":14,"message_index":0}],
 "engine":"presidio+gliner:gliner_multi_pii-v1","ms":48.2}
```

For Chinese or Japanese transcripts change `GLINER_MODEL` (and `SPACY_MODEL`
for tokenisation); the pipeline and the edge function do not change.

## Checking it in PostHog

Every `$ai_generation` from `flixbuddy-chat` carries `$ai_redaction_engine`
(`presidio+gliner:<model>`, `regex-fallback`, or absent when redaction is off)
and `$ai_redacted_entity_count`.

The evaluation **pii_scan_llm_judge** (project 85924, LLM judge, gpt-4.1-mini,
detector style: true = personal data found) runs on every `flixbuddy-chat`
generation. Unredacted traces fail it, Presidio+GLiNER traces pass it. Test
traces are tagged `demo_source = pii-redaction-test`:

```sql
-- restrict both sides to a date range first; an unbounded self-join runs out of memory
SELECT g.properties.$ai_redaction_engine AS engine,
       countIf(e.properties.$ai_evaluation_result = true)  AS pii_found,
       countIf(e.properties.$ai_evaluation_result = false) AS clean
FROM events e
JOIN (SELECT uuid, properties.$ai_redaction_engine FROM events
      WHERE event = '$ai_generation' AND properties.demo_source = 'pii-redaction-test'
        AND timestamp > now() - INTERVAL 7 DAY) g ON g.uuid = toUUID(e.properties.$ai_target_id)
WHERE e.event = '$ai_evaluation' AND e.properties.$ai_evaluation_name = 'pii_scan_llm_judge'
  AND e.timestamp > now() - INTERVAL 7 DAY
GROUP BY engine
```

`scripts/test-pii-redaction.ts` sends three real traces through the service and
through the regex fallback and captures them for exactly this comparison.
