"""File system tools for reading/writing artifacts."""

import json
import os
from autogen_core.tools import FunctionTool

OUTPUT_DIR = "/workspaces/autogen-newsroom/output"
WORKFLOW_DIR = "/workspaces/autogen-newsroom/workflow_states"


async def read_file(file_path: str) -> str:
    """Read content from a file.

    Use to read existing artifacts (e.g., selected_stories.json, First_Draft.md).

    Args:
        file_path: Path to file (relative to output dir or absolute)

    Returns:
        File content as string
    """
    # Security: Only allow reading from output or workflow directory
    if not file_path.startswith('/'):
        file_path = os.path.join(OUTPUT_DIR, file_path)

    file_path = os.path.abspath(file_path)

    # Check if path is within allowed directories
    allowed_prefixes = [os.path.abspath(OUTPUT_DIR), os.path.abspath(WORKFLOW_DIR)]
    if not any(file_path.startswith(prefix) for prefix in allowed_prefixes):
        return "Error: Can only read from output or workflow directory"

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"


async def write_file(file_path: str, content: str) -> str:
    """Write content to a file.

    Use to save artifacts (scripts, JSONs, reports).

    Args:
        file_path: Path to file (relative to output dir)
        content: Content to write

    Returns:
        Success message or error
    """
    full_path = os.path.join(OUTPUT_DIR, os.path.basename(file_path))

    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"File written: {full_path}"
    except Exception as e:
        return f"Error writing file: {e}"


async def list_files() -> str:
    """List all files in the output directory.

    Returns:
        JSON array of filenames
    """
    try:
        files = os.listdir(OUTPUT_DIR)
        return json.dumps(files, indent=2)
    except Exception as e:
        return f"Error: {e}"


read_file_tool = FunctionTool(func=read_file, description="Read content from a file.")
write_file_tool = FunctionTool(func=write_file, description="Write content to a file.")
list_files_tool = FunctionTool(func=list_files, description="List files in output directory.")
