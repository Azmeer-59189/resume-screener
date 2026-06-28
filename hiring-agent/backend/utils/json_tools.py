import json
import re
from typing import Any


def extract_json_object(text: str) -> dict[str, Any]:
    """Extract a JSON object from model output.

    LLMs sometimes wrap JSON in extra text. This keeps each agent forgiving
    without trusting invalid output.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


# NEXT STEP: Use this helper whenever an agent expects JSON from an LLM.
