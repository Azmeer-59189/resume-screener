import os
from functools import lru_cache
from pathlib import Path

import requests


@lru_cache(maxsize=1)
def _local_env_values() -> dict[str, str]:
    """Read simple KEY=value files used during local development."""
    values: dict[str, str] = {}
    roots = [
        Path.cwd() / ".env",
        Path.cwd() / "server" / ".env",
        Path.cwd().parent / "server" / ".env",
    ]

    for env_path in roots:
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            values.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return values


def get_env(name: str, default: str = "") -> str:
    """Prefer real environment variables, then local .env files."""
    return os.environ.get(name) or _local_env_values().get(name, default)


def call_ollama(prompt: str, model: str = "llama3.2:3b") -> str:
    """Call Ollama's local HTTP API.

    Ollama is optional in this project because many student or office laptops
    cannot run local model services comfortably.
    """
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0,
                "top_p": 1,
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("response", "")


def call_groq(prompt: str, model: str = "llama-3.1-8b-instant") -> str:
    """Call Groq's OpenAI-compatible chat completion API."""
    api_key = get_env("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is missing.")

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Return only valid JSON. Do not add markdown.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
            "top_p": 1,
            "max_completion_tokens": 1400,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def call_configured_llm(prompt: str) -> str:
    """Choose the LLM provider from environment variables.

    LLM_PROVIDER can be:
    - groq: cloud API, best for blocked office laptops
    - ollama: local API, best for fully local development
    """
    provider = get_env("LLM_PROVIDER", "ollama").lower()

    if provider == "groq":
        model = get_env("LLM_MODEL", "llama-3.1-8b-instant")
        return call_groq(prompt, model=model)

    model = get_env("LLM_MODEL", "llama3.2:3b")
    return call_ollama(prompt, model=model)


# NEXT STEP: Reuse this helper in every LLM-powered agent.
