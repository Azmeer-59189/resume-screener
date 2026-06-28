import math
import re
from collections import Counter
from functools import lru_cache


def tokenize(text: str) -> list[str]:
    """Turn text into simple lowercase word tokens.

    This fallback tokenizer is not as smart as sentence-transformers, but it is
    deterministic and works offline for tests.
    """
    return re.findall(r"[a-zA-Z][a-zA-Z0-9.+#-]*", text.lower())


def cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    """Measure how similar two numeric vectors are."""
    dot_product = sum(a * b for a, b in zip(vector_a, vector_b))
    norm_a = math.sqrt(sum(a * a for a in vector_a))
    norm_b = math.sqrt(sum(b * b for b in vector_b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot_product / (norm_a * norm_b)


def lexical_similarity(text_a: str, text_b: str) -> float:
    """Offline similarity using word overlap.

    We use this in tests so they do not download an embedding model.
    """
    tokens_a = Counter(tokenize(text_a))
    tokens_b = Counter(tokenize(text_b))
    vocabulary = sorted(set(tokens_a) | set(tokens_b))

    vector_a = [float(tokens_a[token]) for token in vocabulary]
    vector_b = [float(tokens_b[token]) for token in vocabulary]

    return cosine_similarity(vector_a, vector_b)


@lru_cache(maxsize=2)
def get_sentence_transformer(model_name: str):
    """Load an embedding model once and reuse it."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def semantic_similarity(
    text_a: str,
    text_b: str,
    use_model: bool = True,
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
) -> float:
    """Compare two texts with sentence-transformers when available.

    If model loading fails, we fall back to lexical similarity. This keeps the
    project usable on machines without internet/model cache.
    """
    if not use_model:
        return lexical_similarity(text_a, text_b)

    try:
        model = get_sentence_transformer(model_name)
        embeddings = model.encode([text_a, text_b])
        return float(cosine_similarity(embeddings[0].tolist(), embeddings[1].tolist()))
    except Exception:
        return lexical_similarity(text_a, text_b)


# NEXT STEP: Use semantic similarity inside Agent 3: Matching & Scoring.
