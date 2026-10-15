"""
PII redaction for LLM analytics events: Presidio as the framework, GLiNER as the
name/address model inside it.

Why both: Presidio's pattern recognizers are deterministic for emails, phones,
IBANs, cards and IDs and give a confidence score per entity; GLiNER handles
names and addresses across languages far better than the default spaCy NER
(which labelled "Uferstr" and "Reach" as persons in our tests).

Swap the model for CJK transcripts by changing GLINER_MODEL; the pipeline stays.
"""
import os
import time
from typing import Dict, List

from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_analyzer.predefined_recognizers import GLiNERRecognizer
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

GLINER_MODEL = os.environ.get("GLINER_MODEL", "urchade/gliner_multi_pii-v1")
SPACY_MODEL = os.environ.get("SPACY_MODEL", "en_core_web_lg")
DEFAULT_THRESHOLD = float(os.environ.get("REDACTION_THRESHOLD", "0.4"))
# Product, brand and catalogue names that must never be redacted, comma separated in env.
# The catalogue titles are here because GLiNER's "person" label fires on them:
# "The Martian Hog" and "Hog Potter" look exactly like names to it.
_DEFAULT_ALLOW = (
    "FlixBuddy,HogFlix,PostHog,"
    "Frozen Hogs,Hog Potter,Sorcerer's Shrub,The Martian Hog,Jurassic Hog,"
    "Prickly Blinders,Stranger Spines,Breaking Spines,The Grand Budapest Hedgehog,"
    "Fargo Burrows,AvengerHogs Endgame,The Hog Father,Tommy Spines,Late Night,"
    "Lord of the Hogs,InterHogStellar,The Big Hedgowski,Hedgehog's Day,Spiny Business,"
    "Hog Actually,Better Call Saul-hog,Spiny Nights,Dream-Terrarium,The Living Room,"
    "Hogville,Hogwarts,The Garden,Standup Special"
)
ALLOW_LIST = [w for w in os.environ.get("REDACTION_ALLOW_LIST", _DEFAULT_ALLOW).split(",") if w]

# GLiNER labels bare pronouns as "person" in conversational text, so "I'd love to
# help you" came back as "[PERSON]'d love to help [PERSON]". These are matched on
# the whole span, not as substrings, so a real name is never dropped by mistake.
PRONOUN_SPANS = {
    "i", "me", "my", "mine", "myself",
    "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself",
    "we", "us", "our", "ours", "ourselves", "they", "them", "their", "theirs",
    "it", "its", "who", "someone", "everyone", "anybody", "somebody",
}

# GLiNER label -> Presidio entity. "organization" is deliberately left out: in
# chat traces it fires on product names and film titles, which is not PII. Everything else (email, phone, IBAN, credit
# card, IP, URL, national IDs) comes from Presidio's pattern recognizers.
GLINER_ENTITY_MAPPING = {
    "person": "PERSON",
    "name": "PERSON",
    "address": "LOCATION",
    "city": "LOCATION",
    "bank account number": "IBAN_CODE",
    "credit card number": "CREDIT_CARD",
    # Presidio's phone recognizer needs a context word ("call", "phone") to clear the
    # threshold, so a number at the end of "the code is on its way to +44 ..." slipped.
    "phone number": "PHONE_NUMBER",
    "email address": "EMAIL_ADDRESS",
    "passport number": "ID",
    "social security number": "ID",
}

# spaCy is kept for tokenisation only. Its own NER recognizer is removed from the
# registry below, so GLiNER owns PERSON/LOCATION/ORGANIZATION.
NLP_CONFIG = {
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "en", "model_name": SPACY_MODEL}],
}


def _word_aligned(text: str, start: int, end: int) -> bool:
    before = text[start - 1] if start > 0 else " "
    after = text[end] if end < len(text) else " "
    return not (before.isalnum() or after.isalnum())


# Card details and dates of birth that Presidio has no recognizer for. Variable-length
# lookbehind (Presidio uses the `regex` module) keeps the label word out of the span,
# so "CVV 123" becomes "CVV [CARD_CVV]" instead of swallowing the word.
EXTRA_RECOGNIZERS = [
    PatternRecognizer(
        supported_entity="CARD_CVV",
        patterns=[Pattern("cvv", r"(?<=(?i:cvv|cvc|cv2|security code)\W{0,4})\d{3,4}\b", 0.9)],
    ),
    PatternRecognizer(
        supported_entity="CARD_EXPIRY",
        patterns=[Pattern("expiry", r"(?<=(?i:exp|expiry|expires|valid thru|valid until)\W{0,4})(?:0[1-9]|1[0-2])\s?/\s?\d{2,4}\b", 0.9)],
    ),
    PatternRecognizer(
        supported_entity="DATE_OF_BIRTH",
        patterns=[Pattern("dob", r"(?<=(?i:date of birth|dob|born on|birthday)\W{0,8}(?:is\s)?)\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b", 0.95)],
    ),
]


class ScopedGLiNERRecognizer(GLiNERRecognizer):
    """GLiNER only answers for the labels in its own mapping.

    Presidio hands every recognizer the full entity list, and GLiNER turns each
    unknown entity name into an ad-hoc label, so it started tagging "six-digit code"
    as CARD_CVV and "billing_dispute" as CARD_EXPIRY. Pattern recognizers own those.
    """

    def analyze(self, text, entities, nlp_artifacts=None):
        own = [e for e in (entities or []) if e in self.supported_entities] or self.supported_entities
        return super().analyze(text, own, nlp_artifacts)


_NOT_NAMES = {"I", "I'm", "I'd", "I'll", "I've", "You", "Your", "My", "Our", "We", "The", "This", "That",
              "Thanks", "Hi", "Hello", "Dear", "Please", "Sure", "Yes", "No", "Done"}


def _looks_like_a_name(span: str) -> bool:
    # A PERSON span with no capitalised word other than "I" is a phrase, not a name
    # ("I need to verify you" scored 0.51).
    return any(w[:1].isupper() and w.strip(".,!?'") not in _NOT_NAMES for w in span.split())


class Redactor:
    def __init__(self) -> None:
        nlp_engine = NlpEngineProvider(nlp_configuration=NLP_CONFIG).create_engine()
        registry = RecognizerRegistry()
        registry.load_predefined_recognizers(nlp_engine=nlp_engine, languages=["en"])
        # Drop the spaCy-backed recognizer so GLiNER is the only NER source.
        registry.remove_recognizer("SpacyRecognizer")
        registry.add_recognizer(
            ScopedGLiNERRecognizer(
                model_name=GLINER_MODEL,
                entity_mapping=GLINER_ENTITY_MAPPING,
                flat_ner=False,
                multi_label=True,
                threshold=0.3,
            )
        )
        for recognizer in EXTRA_RECOGNIZERS:
            registry.add_recognizer(recognizer)
        self.analyzer = AnalyzerEngine(nlp_engine=nlp_engine, registry=registry, supported_languages=["en"])
        self.anonymizer = AnonymizerEngine()

    def redact_text(self, text: str, threshold: float = DEFAULT_THRESHOLD) -> Dict:
        if not text:
            return {"text": text, "entities": []}
        results = self.analyzer.analyze(text=text, language="en", score_threshold=threshold, allow_list=ALLOW_LIST)
        # allow_list only skips exact matches; GLiNER sometimes returns a wider
        # span ("I'm FlixBuddy"), so drop any span that contains an allowed word.
        results = [r for r in results if not any(w.lower() in text[r.start : r.end].lower() for w in ALLOW_LIST)]
        # Drop spans that are nothing but a pronoun. Whole-span match only.
        results = [r for r in results if text[r.start : r.end].strip().strip("'’\".,!?").lower() not in PRONOUN_SPANS]
        # Drop spans that start or end inside a word. GLiNER occasionally returns a
        # sub-word span, which anonymizes to "packed w[PERSON] existential" - reads
        # as a rendering bug rather than a redaction.
        results = [r for r in results if _word_aligned(text, r.start, r.end)]
        results = [r for r in results if r.entity_type != "PERSON" or _looks_like_a_name(text[r.start : r.end])]
        # Square brackets, not Presidio's default angle brackets. A trace viewer
        # renders "<PERSON>" as an unknown HTML tag and swallows it, so redacted
        # text reads as deleted rather than redacted. "[PERSON]" survives.
        operators = {
            entity: OperatorConfig("replace", {"new_value": f"[{entity}]"})
            for entity in {r.entity_type for r in results}
        } or {"DEFAULT": OperatorConfig("replace", {"new_value": "[REDACTED]"})}
        anonymized = self.anonymizer.anonymize(text=text, analyzer_results=results, operators=operators)
        entities = [
            {"text": text[r.start : r.end], "type": r.entity_type, "score": round(r.score, 2), "start": r.start, "end": r.end}
            for r in sorted(results, key=lambda r: r.start)
        ]
        return {"text": anonymized.text, "entities": entities}

    def redact_messages(self, messages: List[Dict], threshold: float = DEFAULT_THRESHOLD, skip_roles=("system",)) -> Dict:
        """Redact PostHog $ai_input / $ai_output_choices arrays. Keeps roles and order.
        System prompts are skipped by default: they are ours, not the user's, and
        contain product names GLiNER would otherwise chew on."""
        started = time.perf_counter()
        out, all_entities = [], []
        for i, msg in enumerate(messages):
            content = msg.get("content")
            if not isinstance(content, str) or msg.get("role") in skip_roles:
                out.append(msg)
                continue
            r = self.redact_text(content, threshold)
            out.append({**msg, "content": r["text"]})
            all_entities.extend({**e, "message_index": i} for e in r["entities"])
        return {
            "messages": out,
            "entities": all_entities,
            "engine": f"presidio+gliner:{GLINER_MODEL.split('/')[-1]}",
            "ms": round((time.perf_counter() - started) * 1000, 1),
        }
