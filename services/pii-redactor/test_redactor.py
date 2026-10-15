"""Run: pytest -q services/pii-redactor
Samples are real FlixBuddy traces from the Hogflix EU project (12 Mar 2026) plus
one added message with Chinese and Japanese names."""
import pytest

from redactor import Redactor


@pytest.fixture(scope="module")
def r():
    return Redactor()


USER_1 = ("Hi! My name is Leo Prinz, I live at Trubarjeva cesta 79A in Ljubljana. My email is "
          "leo@example.com and my phone is +386 41 123 456. My kid Luna wants to watch something funny tonight")
USER_2 = ("Ok this is a test of PII data scrubbing. I am Leo Prinz and live at Uferstr. 15. "
          "My bank number is 0943042349235052345. I also like pineapple on pizza")
ASSISTANT = ("Hi Leo! It's fantastic to connect with you and help Luna find the perfect funny movie for tonight! "
             "I'm FlixBuddy, and I'm super excited to dive into our catalog. Have you seen Interstellar or The Grand Budapest Hotel?")
ASIAN = ("Hello FlixBuddy, this is Wei Zhang from Singapore, my colleague Tanaka Yuki recommended you. "
         "Reach me at wei.zhang@example.sg or +65 9123 4567. We liked Parasite and Shoplifters.")


def types(res):
    return {e["type"] for e in res["entities"]}


def test_user_1_all_pii_gone(r):
    res = r.redact_text(USER_1)
    for leak in ["Leo Prinz", "Trubarjeva", "leo@example.com", "123 456"]:
        assert leak not in res["text"]
    assert {"PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "LOCATION"} <= types(res)
    assert "funny" in res["text"]  # the rest of the sentence survives


def test_user_2_bank_number_and_street(r):
    res = r.redact_text(USER_2)
    assert "0943042349235052345" not in res["text"]
    assert "Uferstr" not in res["text"]
    assert "pineapple on pizza" in res["text"]


def test_assistant_keeps_product_and_titles(r):
    res = r.redact_text(ASSISTANT)
    assert "Leo" not in res["text"] and "Luna" not in res["text"]
    for keep in ["FlixBuddy", "Interstellar", "The Grand Budapest Hotel"]:
        assert keep in res["text"]


def test_allow_list_survives_wider_span(r):
    res = r.redact_text("Hello there! I'm FlixBuddy, your guide to HogFlix!")
    assert "FlixBuddy" in res["text"] and "HogFlix" in res["text"]


def test_asian_names(r):
    res = r.redact_text(ASIAN)
    for leak in ["Wei Zhang", "Tanaka Yuki", "wei.zhang@example.sg", "9123 4567"]:
        assert leak not in res["text"]
    assert "Reach me at" in res["text"]  # no false PERSON on "Reach"
    assert "Parasite" in res["text"]


def test_messages_skip_system_and_keep_roles(r):
    msgs = [{"role": "system", "content": "You are FlixBuddy for Leo Prinz's demo."},
            {"role": "user", "content": USER_1},
            {"role": "assistant", "content": ASSISTANT}]
    res = r.redact_messages(msgs)
    assert [m["role"] for m in res["messages"]] == ["system", "user", "assistant"]
    assert res["messages"][0]["content"] == msgs[0]["content"]  # untouched
    assert all(e["message_index"] in (1, 2) for e in res["entities"])
    assert all(0 < e["score"] <= 1 for e in res["entities"])
    assert res["engine"].startswith("presidio+gliner")
