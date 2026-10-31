"""Loads the curated knowledge base (product spec §18, engineering spec §34).

The knowledge lives as plain files in `corpus/`, one entry each, so it is
curated and versioned the same way the code is: every change is a reviewed
diff in git, and an entry carries its own `version` that is reported whenever
it is used. Nothing is fetched from the web and nothing is written by users;
retrieved text is treated as untrusted reference material anyway (§34), but
the point of keeping the source in the repository is that it can be audited.

An entry file is a short header, a line of `---`, then the text:

    id: vedic-lagna
    title: Lagna (the Vedic Ascendant)
    category: vedic
    version: 1
    aliases: ascendant, rising sign

`aliases` are extra words a reader might use for the same thing; they are
searched but never shown.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "corpus"

CATEGORIES = frozenset({"vedic", "western", "technical", "education"})


class CorpusError(ValueError):
    """An entry file is malformed. Raised at load time so a bad entry fails
    loudly in tests and at startup, never silently at answer time."""


@dataclass(frozen=True)
class KnowledgeEntry:
    id: str
    title: str
    category: str
    version: int
    aliases: str
    body: str


def _parse(path: Path) -> KnowledgeEntry:
    header, separator, body = path.read_text(encoding="utf-8").partition("\n---\n")
    if not separator:
        raise CorpusError(f"{path.name}: missing the '---' line after the header")

    fields: dict[str, str] = {}
    for line in header.splitlines():
        key, colon, value = line.partition(":")
        if not colon:
            raise CorpusError(f"{path.name}: header line without a colon: {line!r}")
        fields[key.strip()] = value.strip()

    for required in ("id", "title", "category", "version"):
        if not fields.get(required):
            raise CorpusError(f"{path.name}: missing '{required}'")

    if fields["id"] != path.stem:
        raise CorpusError(f"{path.name}: id {fields['id']!r} does not match the file name")
    if fields["category"] not in CATEGORIES:
        raise CorpusError(f"{path.name}: unknown category {fields['category']!r}")
    if not fields["version"].isdigit():
        raise CorpusError(f"{path.name}: version must be a whole number")
    if not body.strip():
        raise CorpusError(f"{path.name}: empty text")

    return KnowledgeEntry(
        id=fields["id"],
        title=fields["title"],
        category=fields["category"],
        version=int(fields["version"]),
        aliases=fields.get("aliases", ""),
        body=body.strip(),
    )


def load_corpus(directory: Path = CORPUS_DIR) -> tuple[KnowledgeEntry, ...]:
    """Every entry in `directory`, ordered by id."""
    entries = tuple(_parse(path) for path in sorted(directory.glob("*.md")))
    ids = [entry.id for entry in entries]
    if len(set(ids)) != len(ids):
        raise CorpusError("duplicate entry ids")
    return entries


@lru_cache(maxsize=1)
def default_corpus() -> tuple[KnowledgeEntry, ...]:
    entries = load_corpus()
    if not entries:
        # The files are shipped with the application. Finding none means a
        # packaging mistake, which should be loud: an empty knowledge base
        # would otherwise just make every answer quietly less informed.
        raise CorpusError(f"no knowledge entries found in {CORPUS_DIR}")
    return entries


def get_entry(entry_id: str) -> KnowledgeEntry | None:
    """One entry by id, or None."""
    return next((e for e in default_corpus() if e.id == entry_id), None)
