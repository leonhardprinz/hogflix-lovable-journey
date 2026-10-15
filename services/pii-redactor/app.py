"""HTTP front for the redactor. One endpoint, called by the Supabase edge
function (or anything else) right before an $ai_generation event is sent.

    uvicorn app:app --port 8787
    curl -X POST localhost:8787/redact -H 'content-type: application/json' \
      -d '{"messages":[{"role":"user","content":"I am Leo Prinz, mail me at leo@example.com"}]}'
"""
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from redactor import DEFAULT_THRESHOLD, Redactor

app = FastAPI(title="hogflix-pii-redactor")
redactor = Redactor()  # loads the models once, at startup


class Message(BaseModel):
    role: str
    content: Optional[str] = None


class RedactRequest(BaseModel):
    messages: List[Message]
    threshold: Optional[float] = None


@app.get("/health")
def health():
    return {"ok": True, "engine": redactor.redact_messages([])["engine"]}


@app.post("/redact")
def redact(req: RedactRequest):
    return redactor.redact_messages([m.model_dump() for m in req.messages], req.threshold or DEFAULT_THRESHOLD)
