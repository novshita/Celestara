"""Finding the curated passages relevant to a question.

BM25 keyword ranking over the knowledge base, held in memory - the corpus is
a few dozen short entries, so there is nothing to gain from an external
index. Behind the `Retriever` protocol so vector search can replace it later
without the AI layer noticing (product spec §18 names RAG, not a technique).

User chart data never comes from here: it comes from the calculation engine.
This supplies explanation and traditional context only.
"""

from __future__ import annotations

import math
import re
import time
from collections import Counter
from dataclasses import dataclass
from typing import Protocol

from app.core.metrics import RETRIEVAL_DURATION
from app.services.knowledge.loader import KnowledgeEntry, default_corpus

#: BM25 constants, the usual defaults.
_K1 = 1.5
_B = 0.75

#: Below this score a match is too weak to be worth putting in front of the
#: model: a single stray common word ("today", "chart") should not pull in an
#: entry. Chosen against sample questions: real topic matches score 3.5 and up,
#: incidental word overlap 2.9 and below.
MIN_SCORE = 3.0

#: Beyond the first, a hit must score at least this fraction of the best one,
#: so a strong match is not padded out with weak neighbours.
RELATIVE_CUTOFF = 0.5

#: Words that carry no topic. Includes the question words people open with and
#: "mean", which appears in nearly every question and no entry.
_STOPWORDS = frozenset(
    """a an and are as at be but by can do does for from has have how i if in is it
    its me my of on or our so than that the their then there these they this to
    us was we what when where which who why will with would you your about tell
    explain mean means meaning please give show want know like also just""".split()
)

_TOKEN = re.compile(r"[a-z0-9]+")


def _stem(token: str) -> str:
    """Crude plural and -ing folding, applied identically to entries and
    queries, so "houses" finds "house" and "transits" finds "transit"."""
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("s") and not token.endswith("ss") and len(token) > 3:
        return token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    return [
        _stem(token)
        for token in _TOKEN.findall(text.lower())
        if token not in _STOPWORDS
    ]


@dataclass(frozen=True)
class KnowledgeHit:
    entry: KnowledgeEntry
    score: float


class Retriever(Protocol):
    def retrieve(
        self, query: str, categories: frozenset[str] | None = None, limit: int = 3
    ) -> list[KnowledgeHit]: ...


class Bm25Retriever:
    """BM25 over an in-memory corpus."""

    def __init__(self, entries: tuple[KnowledgeEntry, ...]) -> None:
        self._entries = entries
        # The title counts double, and aliases are searchable: a question
        # about "rising sign" must find the entry titled "Lagna".
        self._terms: list[Counter[str]] = [
            Counter(tokenize(f"{e.title} {e.title} {e.aliases} {e.body}")) for e in entries
        ]
        self._lengths = [sum(counter.values()) for counter in self._terms]
        self._average_length = sum(self._lengths) / max(len(entries), 1)

        document_frequency: Counter[str] = Counter()
        for counter in self._terms:
            document_frequency.update(counter.keys())
        total = len(entries)
        self._idf = {
            term: math.log(1 + (total - count + 0.5) / (count + 0.5))
            for term, count in document_frequency.items()
        }

    def _score(self, query_terms: list[str], index: int) -> float:
        counter, length = self._terms[index], self._lengths[index]
        score = 0.0
        for term in set(query_terms):
            frequency = counter.get(term, 0)
            if not frequency:
                continue
            norm = _K1 * (1 - _B + _B * length / self._average_length)
            score += self._idf[term] * frequency * (_K1 + 1) / (frequency + norm)
        return score

    def retrieve(
        self, query: str, categories: frozenset[str] | None = None, limit: int = 3
    ) -> list[KnowledgeHit]:
        started = time.perf_counter()
        terms = tokenize(query)

        hits: list[KnowledgeHit] = []
        if terms:
            for index, entry in enumerate(self._entries):
                if categories is not None and entry.category not in categories:
                    continue
                score = self._score(terms, index)
                if score >= MIN_SCORE:
                    hits.append(KnowledgeHit(entry, score))
            hits.sort(key=lambda hit: (-hit.score, hit.entry.id))
            if hits:
                floor = hits[0].score * RELATIVE_CUTOFF
                hits = [hit for hit in hits if hit.score >= floor]

        RETRIEVAL_DURATION.observe(time.perf_counter() - started)
        return hits[:limit]


_default: Bm25Retriever | None = None


def default_retriever() -> Retriever:
    global _default
    if _default is None:
        _default = Bm25Retriever(default_corpus())
    return _default


#: Which parts of the knowledge base a chart system should draw on. Each
#: system sees its own tradition plus the shared technical and educational
#: material; Compare sees everything.
CATEGORIES_BY_SYSTEM: dict[str, frozenset[str]] = {
    "vedic": frozenset({"vedic", "technical", "education"}),
    "western": frozenset({"western", "technical", "education"}),
    "compare": frozenset({"vedic", "western", "technical", "education"}),
}
