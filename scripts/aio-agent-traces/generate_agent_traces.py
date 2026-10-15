"""
HogFlix Help Desk: multi-agent AI traces for the AI observability demo.

Each trace is one customer conversation handled by a small agent system:
a triage agent routes the request, hands off to a specialist (billing, identity,
concierge, shipping), the specialist calls tools across several turns, and some
conversations escalate to a human. Every message, tool argument and tool result
is run through the Presidio + GLiNER redactor in services/pii-redactor before it
is captured, so the traces show granular labels ([CREDIT_CARD], [IBAN_CODE],
[PHONE_NUMBER], [DATE_OF_BIRTH], ...) instead of the raw values.

Runs on a schedule in GitHub Actions (.github/workflows/aio-agent-traces.yml), so
the project keeps getting fresh traces when no laptop is on. Timestamps are spread
over the last WINDOW_MINUTES and never land in the future.

Env:
  PH_PROJECT_API_KEY  project token (required unless DRY_RUN=true)
  PH_HOST             ingestion host, e.g. https://eu.i.posthog.com
  TRACE_COUNT         conversations per run (default 12)
  WINDOW_MINUTES      spread timestamps over this many past minutes (default 120)
  DRY_RUN=true        print one redacted trace instead of sending
  NO_REDACT=true      skip redaction (for comparing before/after)
"""
import json
import os
import random
import sys
import time
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "pii-redactor"))

PH_HOST = os.environ.get("PH_HOST", "https://eu.i.posthog.com").rstrip("/")
PH_KEY = os.environ.get("PH_PROJECT_API_KEY", "")
TRACE_COUNT = int(os.environ.get("TRACE_COUNT", "12"))
WINDOW_MINUTES = int(os.environ.get("WINDOW_MINUTES", "120"))
DRY_RUN = os.environ.get("DRY_RUN") == "true"
NO_REDACT = os.environ.get("NO_REDACT") == "true"
PRODUCT = "hogflix-helpdesk"
SEED_BATCH = "aio-agent-traces-v1"

MODELS = {
    "triage": ("gpt-4.1-mini", "openai", 0.40, 1.60),
    "billing": ("claude-sonnet-4-5", "anthropic", 3.00, 15.00),
    "identity": ("gpt-4.1", "openai", 2.00, 8.00),
    "concierge": ("gemini-2.5-flash", "google", 0.30, 2.50),
    "shipping": ("claude-haiku-4-5", "anthropic", 1.00, 5.00),
    "guard": ("gpt-4.1-nano", "openai", 0.10, 0.40),
}

# Synthetic people. The card numbers are network test numbers, IBANs are the
# published example IBANs, phones use reserved fiction ranges.
PEOPLE = [
    {"name": "Sarah Thompson", "email": "sarah.thompson@example.co.uk", "phone": "+44 7700 900123",
     "card": "4111 1111 1111 1111", "exp": "09/27", "cvv": "123", "iban": "GB82 WEST 1234 5698 7654 32",
     "address": "221B Baker Street, London NW1 6XE", "dob": "14/03/1988", "passport": "533380006", "city": "London"},
    {"name": "Lukas Bauer", "email": "lukas.bauer@example.de", "phone": "+49 170 1234567",
     "card": "5555 5555 5555 4444", "exp": "11/26", "cvv": "456", "iban": "DE89 3704 0044 0532 0130 00",
     "address": "Uferstrasse 12, 10115 Berlin", "dob": "02/07/1991", "passport": "C01X00T47", "city": "Berlin"},
    {"name": "Camille Laurent", "email": "camille.laurent@example.fr", "phone": "06 12 34 56 78",
     "card": "4000 0566 5566 5556", "exp": "03/28", "cvv": "789", "iban": "FR14 2004 1010 0505 0001 3M02 606",
     "address": "12 Rue de Rivoli, 75001 Paris", "dob": "21/11/1985", "passport": "18AV12345", "city": "Paris"},
    {"name": "Marta Novak", "email": "marta.novak@example.si", "phone": "+386 40 123 456",
     "card": "3782 822463 10005", "exp": "06/27", "cvv": "1234", "iban": "SI56 1910 0000 0123 438",
     "address": "Trubarjeva cesta 7, 1000 Ljubljana", "dob": "30/01/1979", "passport": "PB0123456", "city": "Ljubljana"},
    {"name": "James O'Brien", "email": "james.obrien@example.ie", "phone": "+353 85 123 4567",
     "card": "6011 1111 1111 1117", "exp": "12/26", "cvv": "321", "iban": "IE29 AIBK 9311 5212 3456 78",
     "address": "14 Grafton Street, Dublin 2, D02 VK65", "dob": "08/05/1993", "passport": "PA1234567", "city": "Dublin"},
    {"name": "Ana Silva", "email": "ana.silva@example.pt", "phone": "+351 912 345 678",
     "card": "4242 4242 4242 4242", "exp": "08/28", "cvv": "654", "iban": "PT50 0002 0123 1234 5678 9015 4",
     "address": "Rua Augusta 100, 1100-053 Lisboa", "dob": "17/09/1990", "passport": "CA123456", "city": "Lisbon"},
]
FAMILY = ["Michael Johnson", "Emma Thompson", "Noah Bauer", "Léa Laurent", "Rebecca Martinez", "Tomaž Novak"]
TITLES = ["The Martian Hog", "Prickly Blinders", "Stranger Spines", "Breaking Spines", "Hog Potter",
          "The Grand Budapest Hedgehog", "InterHogStellar", "Lord of the Hogs"]

SYSTEM = {
    "triage": "You are the HogFlix Help Desk triage agent. Classify the request and hand off to exactly one specialist: billing, identity, concierge or shipping. Never ask for full card numbers.",
    "billing": "You are the HogFlix billing specialist. Use tools to look up charges and issue refunds. Confirm amounts before refunding.",
    "identity": "You are the HogFlix identity specialist. Verify the member before changing account details. Escalate to a human after two failed checks.",
    "concierge": "You are FlixBuddy, the HogFlix concierge. Recommend titles from the catalog and manage family profiles.",
    "shipping": "You are the HogFlix shipping specialist for the collector box. Update addresses and track parcels.",
    "guard": "Check the assistant's draft reply for personal data that must not be repeated back. Answer PASS or FAIL with a reason.",
}

_redactor = None


def redactor():
    global _redactor
    if _redactor is None and not NO_REDACT:
        from redactor import Redactor
        _redactor = Redactor()
    return _redactor


class Stats:
    def __init__(self):
        self.count = 0
        self.types = set()


def scrub(value, stats):
    """Redact every string inside messages, tool arguments and tool results."""
    if NO_REDACT:
        return value
    if isinstance(value, str):
        if len(value) < 4:
            return value
        out = redactor().redact_text(value)
        stats.count += len(out["entities"])
        stats.types.update(e["type"] for e in out["entities"])
        return out["text"]
    if isinstance(value, list):
        return [scrub(v, stats) for v in value]
    if isinstance(value, dict):
        if value.get("role") == "system":
            return value
        return {k: (v if k in ("role", "type", "id", "tool_call_id", "name") else scrub(v, stats)) for k, v in value.items()}
    return value


def tokens(obj):
    return max(8, len(json.dumps(obj, ensure_ascii=False)) // 4)


class Trace:
    def __init__(self, person, intent, start):
        self.person = person
        self.intent = intent
        self.trace_id = str(uuid.uuid4())
        self.session_id = str(uuid.uuid4())
        self.distinct_id = f"member_{abs(hash(person['email'])) % 100000:05d}"
        self.clock = start
        self.events = []
        self.stats = Stats()
        self.cost = 0.0
        self.error = False
        self.last_gen = None
        self.agents = {}

    def open_agent(self, name, parent):
        span_id = str(uuid.uuid4())
        self.agents[name] = (span_id, parent, self.clock)
        return span_id

    def close_agent(self, name, input_state, output_state):
        span_id, parent, started = self.agents.pop(name)
        props = {
            "$ai_span_id": span_id,
            "$ai_parent_id": parent,
            "$ai_span_name": f"{name}_agent",
            "$ai_input_state": scrub(input_state, self.stats),
            "$ai_output_state": scrub(output_state, self.stats),
            "$ai_latency": round((self.clock - started).total_seconds(), 3),
            "$ai_is_error": False,
        }
        self.emit("$ai_span", self.clock, props)

    def tick(self, seconds):
        self.clock += timedelta(seconds=seconds)
        return self.clock

    def base(self, extra):
        props = {
            "$ai_trace_id": self.trace_id,
            "$ai_session_id": self.session_id,
            "$ai_product": PRODUCT,
            "agent_intent": self.intent,
            "demo_source": "aio-agent-traces",
            "seed_batch": SEED_BATCH,
            "$process_person_profile": False,
        }
        props.update(extra)
        return props

    def emit(self, event, ts, props):
        self.events.append({
            "event": event,
            "distinct_id": self.distinct_id,
            "timestamp": ts.isoformat(),
            "uuid": str(uuid.uuid4()),
            "properties": self.base(props),
        })

    def span(self, name, parent, input_state, output_state, latency, is_error=False, error=None):
        span_id = str(uuid.uuid4())
        ts = self.tick(latency)
        props = {
            "$ai_span_id": span_id,
            "$ai_parent_id": parent,
            "$ai_span_name": name,
            "$ai_input_state": scrub(input_state, self.stats),
            "$ai_output_state": scrub(output_state, self.stats),
            "$ai_latency": round(latency, 3),
            "$ai_is_error": is_error,
        }
        if error:
            props["$ai_error"] = error
            self.error = True
        self.emit("$ai_span", ts, props)
        return span_id

    def generation(self, agent, parent, messages, reply, tool_calls=None, tools=None):
        model, provider, in_price, out_price = MODELS[agent]
        choice = {"role": "assistant", "content": reply}
        if tool_calls:
            choice["tool_calls"] = [
                {"id": f"call_{uuid.uuid4().hex[:12]}", "type": "function",
                 "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}
                for name, args in tool_calls
            ]
        full_input = [{"role": "system", "content": SYSTEM[agent]}] + messages
        in_tok, out_tok = tokens(full_input) + 120, tokens(choice) + 10
        latency = round(random.uniform(0.6, 2.8) + out_tok / 180, 3)
        cost_in, cost_out = in_tok * in_price / 1e6, out_tok * out_price / 1e6
        self.cost += cost_in + cost_out
        ts = self.tick(latency)
        gen_id = str(uuid.uuid4())
        self.last_gen = gen_id
        props = {
            "$ai_span_id": gen_id,
            "$ai_parent_id": parent,
            "$ai_span_name": f"{agent}_agent",
            "$ai_model": model,
            "$ai_provider": provider,
            "$ai_input": scrub(full_input, self.stats),
            "$ai_output_choices": scrub([choice], self.stats),
            "$ai_input_tokens": in_tok,
            "$ai_output_tokens": out_tok,
            "$ai_input_cost_usd": round(cost_in, 6),
            "$ai_output_cost_usd": round(cost_out, 6),
            "$ai_total_cost_usd": round(cost_in + cost_out, 6),
            "$ai_latency": latency,
            "$ai_http_status": 200,
            "$ai_is_error": False,
        }
        if tools:
            props["$ai_tools"] = [{"type": "function", "function": {"name": t, "parameters": {"type": "object"}}} for t in tools]
        self.emit("$ai_generation", ts, props)
        return choice

    def finish(self, root_input, root_output, started):
        latency = (self.clock - started).total_seconds()
        props = {
            "$ai_span_name": f"helpdesk:{self.intent}",
            "$ai_trace_name": f"helpdesk:{self.intent}",
            "$ai_input_state": scrub(root_input, self.stats),
            "$ai_output_state": scrub(root_output, self.stats),
            "$ai_latency": round(latency, 3),
            "$ai_is_error": self.error,
            "$ai_total_cost_usd": round(self.cost, 6),
        }
        if not NO_REDACT:
            props.update({
                "$ai_content_redacted": True,
                "$ai_redaction_engine": "presidio+gliner:gliner_multi_pii-v1",
                "$ai_redacted_entity_count": self.stats.count,
                "$ai_redacted_entity_types": sorted(self.stats.types),
            })
        self.emit("$ai_trace", self.clock, props)
        for e in self.events:
            if not NO_REDACT:
                e["properties"].setdefault("$ai_content_redacted", True)
                e["properties"].setdefault("$ai_redaction_engine", "presidio+gliner:gliner_multi_pii-v1")
        return self.events


def tool_result(trace, parent, name, args, result, fail=False):
    parent = trace.last_gen or parent
    if fail:
        return trace.span(f"tool:{name}", parent, args, {"error": "upstream timeout after 10s"}, 10.0, True, f"{name} timed out")
    return trace.span(f"tool:{name}", parent, args, result, random.uniform(0.08, 0.9))


def triage(trace, root, user_msg, route):
    msgs = [{"role": "user", "content": user_msg}]
    tri = trace.open_agent("triage", root)
    choice = trace.generation("triage", tri, msgs, f"Routing to the {route} specialist.",
                              tool_calls=[("handoff", {"to": f"{route}_agent", "reason": trace.intent})],
                              tools=["handoff"])
    trace.close_agent("triage", [{"role": "user", "content": user_msg}], {"route": route})
    trace.span("handoff", root, {"from": "triage_agent", "to": f"{route}_agent", "summary": user_msg}, {"accepted": True}, 0.05)
    trace.last_gen = None
    return msgs


def billing_dispute(trace, root):
    p = trace.person
    user = (f"Hi, I'm {p['name']}. My card {p['card']}, exp {p['exp']}, CVV {p['cvv']} was charged twice for Premium this month. "
            f"My account email is {p['email']}, you can call me on {p['phone']}.")
    msgs = triage(trace, root, user, "billing")
    a = trace.open_agent("billing", root)
    c1 = trace.generation("billing", a, msgs, "Let me find your account and the charges.",
                          tool_calls=[("lookup_customer", {"email": p["email"]}), ("list_charges", {"card": p["card"], "days": 31})],
                          tools=["lookup_customer", "list_charges", "issue_refund"])
    tool_result(trace, a, "lookup_customer", {"email": p["email"]}, {"customer": p["name"], "plan": "Premium", "phone": p["phone"]})
    tool_result(trace, a, "list_charges", {"card": p["card"]}, {"charges": [{"amount": 17.99, "date": "2026-10-01"}, {"amount": 17.99, "date": "2026-10-01"}]})
    msgs = msgs + [c1, {"role": "tool", "content": "2 charges of 17.99 EUR on 2026-10-01"},
                   {"role": "assistant", "content": f"I can see two charges of 17.99 EUR on 1 October, {p['name'].split()[0]}. Shall I refund one?"},
                   {"role": "user", "content": f"Yes please, and send it to my bank instead, IBAN {p['iban']}, account holder {p['name']}."}]
    fail = random.random() < 0.12
    c2 = trace.generation("billing", a, msgs, "Issuing the refund now.",
                          tool_calls=[("issue_refund", {"amount": 17.99, "iban": p["iban"], "holder": p["name"]})])
    tool_result(trace, a, "issue_refund", {"amount": 17.99, "iban": p["iban"]}, {"refund_id": f"rf_{uuid.uuid4().hex[:8]}", "status": "queued"}, fail=fail)
    if fail:
        reply = "Our payments system did not respond, so I have passed this to a colleague who will confirm the refund by email."
        trace.span("handoff_to_human", root, {"queue": "billing-escalations", "customer_email": p["email"]}, {"ticket": f"HF-{random.randint(10000, 99999)}"}, 0.2)
    else:
        reply = f"Done, 17.99 EUR is on its way to the account ending {p['iban'].replace(' ', '')[-4:]}. You'll get a confirmation at {p['email']}."
    guard(trace, a, reply)
    trace.generation("billing", a, msgs + [c2, {"role": "tool", "content": "refund queued" if not fail else "timeout"}], reply)
    trace.close_agent("billing", [{"role": "user", "content": user}], [{"role": "assistant", "content": reply}])
    return user, reply


def account_recovery(trace, root):
    p = trace.person
    user = (f"I lost access to my account. My name is {p['name']}, date of birth {p['dob']}, "
            f"passport number {p['passport']}. Please send the reset code to {p['phone']}.")
    msgs = triage(trace, root, user, "identity")
    a = trace.open_agent("identity", root)
    c1 = trace.generation("identity", a, msgs, "I need to verify you first.",
                          tool_calls=[("verify_identity", {"name": p["name"], "dob": p["dob"], "document": p["passport"]})],
                          tools=["verify_identity", "send_reset_code", "update_email"])
    ok = random.random() > 0.2
    tool_result(trace, a, "verify_identity", {"name": p["name"], "dob": p["dob"]}, {"match": ok, "confidence": 0.97 if ok else 0.41})
    if not ok:
        msgs = msgs + [c1, {"role": "tool", "content": "no match"},
                       {"role": "assistant", "content": "The details don't match our records. Could you confirm your billing address?"},
                       {"role": "user", "content": f"Sure, it's {p['address']}. And my old email was {p['email']}."}]
        trace.generation("identity", a, msgs, "Still no match, escalating.",
                         tool_calls=[("verify_identity", {"address": p["address"], "email": p["email"]})])
        tool_result(trace, a, "verify_identity", {"address": p["address"]}, {"match": False})
        trace.span("handoff_to_human", root, {"queue": "identity-review", "reason": "two failed checks", "phone": p["phone"]}, {"ticket": f"HF-{random.randint(10000, 99999)}"}, 0.2)
        reply = f"For your security a colleague will review this and call you back on {p['phone']} within a day."
    else:
        msgs = msgs + [c1, {"role": "tool", "content": "match"}]
        trace.generation("identity", a, msgs, "Verified, sending the code.",
                         tool_calls=[("send_reset_code", {"phone": p["phone"]})])
        tool_result(trace, a, "send_reset_code", {"phone": p["phone"]}, {"sent": True})
        reply = f"Thanks {p['name'].split()[0]}, you're verified. A six-digit code is on its way to {p['phone']}."
    guard(trace, a, reply)
    trace.generation("identity", a, msgs, reply)
    trace.close_agent("identity", [{"role": "user", "content": user}], [{"role": "assistant", "content": reply}])
    return user, reply


def family_profiles(trace, root):
    p = trace.person
    kid = random.choice(FAMILY)
    user = (f"Can you add a kids profile for {kid}, born on 05/06/2016, and recommend something for a family night? "
            f"We loved {random.choice(TITLES)}. Send the list to {p['email']}.")
    msgs = triage(trace, root, user, "concierge")
    a = trace.open_agent("concierge", root)
    c1 = trace.generation("concierge", a, msgs, "Creating the profile and checking the catalog.",
                          tool_calls=[("create_profile", {"name": kid, "dob": "05/06/2016", "rating": "PG"}),
                                      ("catalog_search", {"mood": "family", "max_rating": "PG", "limit": 3})],
                          tools=["create_profile", "catalog_search", "send_list"])
    tool_result(trace, a, "create_profile", {"name": kid, "dob": "05/06/2016"}, {"profile_id": f"pr_{uuid.uuid4().hex[:6]}"})
    picks = random.sample(TITLES, 3)
    trace.span("retrieval:watch_history", a, {"member": trace.distinct_id, "k": 20}, {"documents": 20, "top_genre": "sci-fi comedy"}, random.uniform(0.1, 0.4))
    tool_result(trace, a, "catalog_search", {"mood": "family"}, {"titles": picks})
    msgs = msgs + [c1, {"role": "tool", "content": json.dumps(picks)}]
    trace.generation("concierge", a, msgs, "Sending the list.", tool_calls=[("send_list", {"to": p["email"], "titles": picks})])
    tool_result(trace, a, "send_list", {"to": p["email"]}, {"sent": True})
    reply = f"{kid.split()[0]}'s profile is ready. For tonight: {', '.join(picks)}. I've emailed the list to {p['email']}."
    guard(trace, a, reply)
    trace.generation("concierge", a, msgs, reply)
    trace.close_agent("concierge", [{"role": "user", "content": user}], [{"role": "assistant", "content": reply}])
    return user, reply


def address_change(trace, root):
    p = trace.person
    new = random.choice([q for q in PEOPLE if q is not p])["address"]
    user = (f"I moved. Please ship my collector box to {new} instead of {p['address']}. "
            f"Courier can reach me on {p['phone']}. Order was paid with the card ending {p['card'][-4:]}.")
    msgs = triage(trace, root, user, "shipping")
    a = trace.open_agent("shipping", root)
    c1 = trace.generation("shipping", a, msgs, "Updating the address and checking the parcel.",
                          tool_calls=[("update_address", {"old": p["address"], "new": new}), ("track_parcel", {"phone": p["phone"]})],
                          tools=["update_address", "track_parcel"])
    tool_result(trace, a, "update_address", {"new": new}, {"ok": True})
    late = random.random() < 0.15
    tool_result(trace, a, "track_parcel", {"phone": p["phone"]}, {"status": "in transit", "eta": "2 days"}, fail=late)
    reply = (f"Your box will now go to {new}. The courier will text {p['phone']} before delivery."
             if not late else f"The address is updated to {new}. Tracking is slow right now, I'll email {p['email']} once it moves.")
    guard(trace, a, reply)
    trace.generation("shipping", a, msgs + [c1], reply)
    trace.close_agent("shipping", [{"role": "user", "content": user}], [{"role": "assistant", "content": reply}])
    return user, reply


def guard(trace, root, draft):
    """A cheap model checks the draft for personal data before it goes out."""
    leaked = any(x in draft for x in ("@", "+", "IBAN"))
    trace.generation("guard", root, [{"role": "user", "content": draft}],
                     "FAIL: reply repeats contact details back to the member" if leaked else "PASS")


SCENARIOS = [(billing_dispute, "billing_dispute", 3), (account_recovery, "account_recovery", 2),
             (family_profiles, "family_profiles", 3), (address_change, "address_change", 2)]


def build_trace(start):
    fn, intent, _ = random.choices(SCENARIOS, weights=[w for *_, w in SCENARIOS])[0]
    trace = Trace(random.choice(PEOPLE), intent, start)
    root = trace.trace_id
    user, reply = fn(trace, root)
    return trace.finish([{"role": "user", "content": user}], [{"role": "assistant", "content": reply}], start), trace


def send(events):
    for i in range(0, len(events), 100):
        body = json.dumps({"api_key": PH_KEY, "batch": events[i:i + 100]}).encode()
        req = urllib.request.Request(f"{PH_HOST}/batch/", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status != 200:
                raise RuntimeError(f"batch failed: {r.status}")


def main():
    if not DRY_RUN and not PH_KEY:
        sys.exit("PH_PROJECT_API_KEY is not set")
    now = datetime.now(timezone.utc)
    t0 = time.time()
    all_events, summary = [], []
    count = 1 if DRY_RUN else TRACE_COUNT
    for _ in range(count):
        start = now - timedelta(minutes=random.uniform(3, WINDOW_MINUTES))
        events, trace = build_trace(start)
        all_events += events
        summary.append((trace.intent, len(events), trace.stats.count, sorted(trace.stats.types)))
    if DRY_RUN:
        print(json.dumps(all_events, indent=2, ensure_ascii=False)[:6000])
    else:
        send(all_events)
    for intent, n, ents, types in summary:
        print(f"{intent:18s} events={n:3d} redacted={ents:3d} {','.join(types)}")
    print(f"{len(all_events)} events, {len(summary)} traces, {time.time() - t0:.1f}s, sent={not DRY_RUN}")


if __name__ == "__main__":
    main()
