"""Text processing tools."""

import json
from autogen_core.tools import FunctionTool


async def count_words(text: str) -> str:
    """Count words and characters in text.

    Use to verify script length meets requirements.

    Args:
        text: Text to analyze

    Returns:
        Word and character count
    """
    words = len(text.split())
    chars = len(text)
    return json.dumps({"words": words, "characters": chars})


async def summarize_text(text: str, max_sentences: int = 3) -> str:
    """Create a brief summary of text.

    Use to summarize long articles or create story previews.

    Args:
        text: Text to summarize
        max_sentences: Maximum sentences in summary

    Returns:
        Summarized text
    """
    # Simple extraction-based summary
    sentences = text.replace('!', '.').replace('?', '.').split('.')
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    summary = '. '.join(sentences[:max_sentences]) + '.'
    return summary


count_words_tool = FunctionTool(func=count_words, description="Count words and characters.")
summarize_text_tool = FunctionTool(func=summarize_text, description="Summarize text to key points.")
