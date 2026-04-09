"""Web search and fetch tools."""

import json
import re
import aiohttp
from autogen_core.tools import FunctionTool


async def search_web(query: str, num_results: int = 10) -> str:
    """Search the web for current news and information.

    Use this to find real news stories, verify facts, and research topics.
    Returns JSON with title, link, snippet, and date for each result.

    Args:
        query: Search query string (e.g., "Albania news today")
        num_results: Number of results (default 10, max 20)

    Returns:
        JSON string with search results
    """
    # DuckDuckGo (free, no API key)
    from ddgs import DDGS

    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=min(num_results, 20)))

        formatted = []
        for r in results:
            formatted.append({
                "title": r.get("title"),
                "link": r.get("href"),
                "snippet": r.get("body"),
                "source": r.get("href", "").split('/')[2] if r.get("href") else "unknown"
            })

        return json.dumps(formatted, indent=2)


async def fetch_url(url: str, max_length: int = 5000) -> str:
    """Fetch content from a URL.

    Use this to read full articles, verify story details, or fact-check claims.
    Returns the page content as text.

    Args:
        url: URL to fetch
        max_length: Maximum characters to return (default 5000)

    Returns:
        Page content as text
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=30) as response:
            if response.status == 200:
                text = await response.text()
                # Basic HTML stripping
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                return text[:max_length]
            return f"Error: HTTP {response.status}"


# Tool instances
web_search_tool = FunctionTool(
    func=search_web,
    description="Search the web for current news and information. Returns real search results with URLs."
)

fetch_url_tool = FunctionTool(
    func=fetch_url,
    description="Fetch content from a URL to read articles or verify facts."
)
