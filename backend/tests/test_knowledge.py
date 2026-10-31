"""The curated knowledge base: that it loads, that it is sound, and that
retrieval finds what it should and nothing it should not."""

from __future__ import annotations

import pytest

from app.services.ai.safety import check_output
from app.services.astrology.common.constants import NAVAGRAHA
from app.services.astrology.western.constants import western_bodies
from app.services.knowledge.loader import (
    CATEGORIES,
    CorpusError,
    default_corpus,
    load_corpus,
)
from app.services.knowledge.retrieval import (
    CATEGORIES_BY_SYSTEM,
    Bm25Retriever,
    default_retriever,
    tokenize,
)


def _ids(query: str, system: str = "compare") -> list[str]:
    return [hit.entry.id for hit in default_retriever().retrieve(query, CATEGORIES_BY_SYSTEM[system])]


# --- the corpus itself --------------------------------------------------------


def test_the_corpus_loads_and_is_not_empty():
    assert len(default_corpus()) >= 40


def test_every_entry_is_complete_and_well_formed():
    for entry in default_corpus():
        assert entry.category in CATEGORIES
        assert entry.version >= 1
        assert entry.title and entry.body


def test_entries_are_short_enough_to_put_in_a_prompt():
    assert max(len(entry.body.split()) for entry in default_corpus()) <= 130


def test_no_entry_asserts_certainty_or_directs_a_risky_action():
    """The output backstop applied to the knowledge itself: curated text must
    clear the same bar the model's answers are held to."""
    offenders = {e.id: check_output(e.body) for e in default_corpus() if check_output(e.body)}
    assert offenders == {}


def test_every_graha_has_an_entry():
    ids = {entry.id for entry in default_corpus()}
    assert {f"vedic-graha-{name.lower()}" for name in NAVAGRAHA} <= ids


def test_every_western_body_has_an_entry():
    ids = {entry.id for entry in default_corpus()}
    assert {f"western-planet-{name.lower()}" for name in western_bodies(True)} <= ids


def test_the_dasha_lengths_stated_add_up_to_the_full_cycle():
    body = next(e.body for e in default_corpus() if e.id == "vedic-vimshottari")
    years = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
             "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
    for lord, length in years.items():
        assert f"{lord} {length}" in body
    assert sum(years.values()) == 120


# --- loader errors ---------------------------------------------------------------


def _write(directory, name, text):
    (directory / f"{name}.md").write_text(text)


GOOD = "id: a\ntitle: A\ncategory: vedic\nversion: 1\n---\nSome text.\n"


def test_a_valid_directory_loads(tmp_path):
    _write(tmp_path, "a", GOOD)
    assert [e.id for e in load_corpus(tmp_path)] == ["a"]


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("id: a\ntitle: A\ncategory: vedic\nversion: 1\nSome text.\n", "---"),
        ("id: a\ntitle: A\nversion: 1\n---\nText\n", "category"),
        ("id: a\ntitle: A\ncategory: nonsense\nversion: 1\n---\nText\n", "unknown category"),
        ("id: a\ntitle: A\ncategory: vedic\nversion: x\n---\nText\n", "version"),
        ("id: other\ntitle: A\ncategory: vedic\nversion: 1\n---\nText\n", "file name"),
        ("id: a\ntitle: A\ncategory: vedic\nversion: 1\n---\n   \n", "empty"),
        ("id: a\ntitle: A\ncategory vedic\nversion: 1\n---\nText\n", "colon"),
    ],
)
def test_malformed_entries_are_rejected_loudly(tmp_path, text, message):
    _write(tmp_path, "a", text)
    with pytest.raises(CorpusError, match=message):
        load_corpus(tmp_path)


# --- retrieval ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("query", "system", "expected_first"),
    [
        ("What does my rising sign mean?", "vedic", "vedic-lagna"),
        ("what is a nakshatra", "vedic", "vedic-nakshatras"),
        ("explain the Vimshottari dasha", "vedic", "vedic-vimshottari"),
        ("what does Saturn mean in my chart", "vedic", "vedic-graha-saturn"),
        ("what does Saturn mean in my chart", "western", "western-planet-saturn"),
        ("is a trine good", "western", "western-aspects"),
        ("when does sade sati start", "vedic", "vedic-sade-sati"),
        ("my birth time is unknown, what changes", "vedic", "tech-birth-time-uncertainty"),
        ("what is the Midheaven", "western", "western-angles"),
        ("is astrology scientific", "western", "edu-astrology-as-reflection"),
        ("why is my moon in a different sign in vedic", "compare", "tech-sidereal-vs-tropical"),
    ],
)
def test_the_right_entry_comes_first(query, system, expected_first):
    assert _ids(query, system)[0] == expected_first


@pytest.mark.parametrize("query", ["how are you today", "tell me about my chart", "hello", "", "   ", "the of and"])
def test_vague_or_empty_questions_retrieve_nothing(query):
    assert _ids(query) == []


def test_a_system_only_sees_its_own_tradition():
    western_only = _ids("what does Saturn mean", "western")
    vedic_only = _ids("what does Saturn mean", "vedic")

    assert all(not i.startswith("vedic-") for i in western_only)
    assert all(not i.startswith("western-") for i in vedic_only)


def test_aliases_are_searchable():
    # "ascendant" and "rising sign" are aliases of the Lagna entry's title.
    assert _ids("ascendant", "vedic")[0] == "vedic-lagna"


def test_weak_neighbours_are_not_padded_onto_a_strong_match():
    assert _ids("when does sade sati start", "vedic") == ["vedic-sade-sati"]


def test_the_limit_is_respected():
    hits = default_retriever().retrieve("vedic and western difference", limit=2)
    assert len(hits) <= 2


def test_results_are_ordered_best_first_and_deterministic():
    first = default_retriever().retrieve("difference between vedic and western", limit=5)
    second = default_retriever().retrieve("difference between vedic and western", limit=5)

    assert [h.entry.id for h in first] == [h.entry.id for h in second]
    assert [h.score for h in first] == sorted((h.score for h in first), reverse=True)


def test_an_empty_corpus_retrieves_nothing():
    assert Bm25Retriever(()).retrieve("saturn") == []


@pytest.mark.parametrize(("word", "stem"), [("houses", "house"), ("transits", "transit"), ("dashas", "dasha"), ("class", "class")])
def test_plurals_fold_to_the_same_term(word, stem):
    assert tokenize(word) == [stem]


def test_a_missing_corpus_fails_loudly_not_silently(monkeypatch):
    from app.services.knowledge import loader

    loader.default_corpus.cache_clear()
    monkeypatch.setattr(loader, "load_corpus", lambda: ())
    try:
        with pytest.raises(CorpusError, match="no knowledge entries"):
            loader.default_corpus()
    finally:
        monkeypatch.undo()
        loader.default_corpus.cache_clear()
