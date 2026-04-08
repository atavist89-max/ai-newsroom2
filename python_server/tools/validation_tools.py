"""Validation and verification tools."""

import json
import aiohttp
from autogen_core.tools import FunctionTool


async def validate_json(json_string: str) -> str:
    """Validate JSON string format.

    Use to verify story JSON, evaluation JSON, fact-check JSON are valid.

    Args:
        json_string: String to validate

    Returns:
        Validation result
    """
    try:
        data = json.loads(json_string)
        return json.dumps({"valid": True, "type": type(data).__name__})
    except json.JSONDecodeError as e:
        return json.dumps({"valid": False, "error": str(e)})


async def check_url(url: str) -> str:
    """Check if URL is accessible.

    Use to verify news source URLs are real and accessible.

    Args:
        url: URL to check

    Returns:
        Status check result
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.head(url, timeout=10, allow_redirects=True) as resp:
                return json.dumps({
                    "accessible": resp.status < 400,
                    "status": resp.status,
                    "final_url": str(resp.url)
                })
    except Exception as e:
        return json.dumps({"accessible": False, "error": str(e)})


validate_json_tool = FunctionTool(func=validate_json, description="Validate JSON format.")
check_url_tool = FunctionTool(func=check_url, description="Check if URL is accessible.")
