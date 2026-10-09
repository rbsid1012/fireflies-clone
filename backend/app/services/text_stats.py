"""Tokenizing and TF-IDF scoring used by the heuristic summarizer."""
import math
import re
from collections import Counter

_WORD = re.compile(r"[A-Za-z][A-Za-z0-9'\-]{2,}")

STOPWORDS = set("""
a about above after again all also am an and any are aren't as at be because been before being below
between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during
each few for from further had hadn't has hasn't have haven't having he her here hers him his how i i'd
i'll i'm i've if in into is isn't it it's its itself let's me more most my myself no nor not of off on
once only or other ought our ours out over own same she should shouldn't so some such than that that's
the their theirs them then there there's these they they'd they'll they're they've this those through to
too under until up very was wasn't we we'd we'll we're we've were weren't what what's when where which
while who whom why with won't would wouldn't you you'd you'll you're you've your yours
yeah yes okay ok right sure just like think going know really thing things got get gets want need good
great thanks thank also maybe something lot kind sort actually basically honestly mostly pretty bit
quite well oh um uh mean say said see look make made take took come back still even much many one two
three way now today tomorrow yesterday week time day let will would'nt probably around able first
second next last little start work end per new goes help put use using used keep give long big small hear ask add every four five six thousand today's another anyone everyone anything everything happy sounds works fine
""".split())


# Words present in every window still score a little (so a one-window meeting has keywords)
IDF_FLOOR = 0.1


def tokenize(text: str) -> list[str]:
    words = (w.lower().strip("'-") for w in _WORD.findall(text))
    return [w[:-2] if w.endswith("'s") else w for w in words if w not in STOPWORDS]


def top_terms(
    docs: list[list[str]], target: list[str] | None = None, k: int = 5, exclude: set[str] | None = None
) -> list[str]:
    """Top-k terms of `target` (default: all docs) by tf * idf, where each doc is one window."""
    exclude = exclude or set()
    n = len(docs)
    df: Counter[str] = Counter()
    for doc in docs:
        df.update(set(doc))
    tf = Counter(target if target is not None else [t for d in docs for t in d])
    scored = [
        (count * (math.log((1 + n) / (1 + df[t])) + IDF_FLOOR), t)
        for t, count in tf.items()
        if t not in exclude and len(t) > 2
    ]
    # Tie-break alphabetically so output is deterministic
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [t for _, t in scored[:k]]
