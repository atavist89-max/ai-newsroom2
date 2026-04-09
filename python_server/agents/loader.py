"""
Agent Loader for AI Newsroom Podcast Producer
Loads agent configurations from JSON files and creates AssistantAgent instances.
"""

import json
import os
import sys
from typing import Dict, List
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.agents import AssistantAgent
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools import (
    web_search_tool,
    fetch_url_tool,
    read_file_tool,
    write_file_tool,
    list_files_tool,
    count_words_tool,
    summarize_text_tool,
    validate_json_tool,
    check_url_tool,
)

load_dotenv()

# Get API key from environment
KIMI_API_KEY = os.getenv("KIMI_API_KEY", "sk-YOUR-REAL-API-KEY")

# Tool registry mapping tool names to instances
TOOL_REGISTRY = {
    "web_search": web_search_tool,
    "fetch_url": fetch_url_tool,
    "read_file": read_file_tool,
    "write_file": write_file_tool,
    "list_files": list_files_tool,
    "count_words": count_words_tool,
    "summarize_text": summarize_text_tool,
    "validate_json": validate_json_tool,
    "check_url": check_url_tool,
}


class AgentLoader:
    """Loads and manages AutoGen agents from JSON configuration files."""
    
    def __init__(self, config_dir: str = None):
        # Default to parent directory's autogen-config/agents when running from python_server
        if config_dir is None:
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            config_dir = os.path.join(current_dir, "..", "..", "autogen-config", "agents")
            config_dir = os.path.normpath(config_dir)
        self.config_dir = config_dir
        self._client = None
        self._agents: Dict[str, AssistantAgent] = {}
        
    @property
    def client(self) -> OpenAIChatCompletionClient:
        """Lazy initialization of the Kimi client."""
        if self._client is None:
            self._client = OpenAIChatCompletionClient(
                model="kimi-k2.5",
                api_key=KIMI_API_KEY,
                base_url="https://api.moonshot.ai/v1",
                temperature=1,
                max_tokens=16000,
                model_info={
                    "vision": True,
                    "function_calling": True,
                    "json_output": True,
                    "structured_output": True,
                    "family": "unknown"
                }
            )
        return self._client
    
    def load_agent_from_json(self, filepath: str) -> AssistantAgent:
        """
        Load a single agent configuration from a JSON file.
        
        Args:
            filepath: Path to the JSON configuration file
            
        Returns:
            AssistantAgent instance configured from the JSON file
        """
        with open(filepath, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Get tools from config
        tool_names = config.get("tools", [])
        tools = []
        for tool_name in tool_names:
            if tool_name in TOOL_REGISTRY:
                tools.append(TOOL_REGISTRY[tool_name])
            else:
                print(f"[AgentLoader] Warning: Tool '{tool_name}' not found for agent '{config['name']}'")
        
        print(f"[AgentLoader] Loading {config['name']} with {len(tools)} tools: {tool_names}")
        
        return AssistantAgent(
            name=config["name"],
            system_message=config["system_message"],
            model_client=self.client,
            description=config.get("description", ""),
            tools=tools,
            reflect_on_tool_use=False,  # Disable to avoid Kimi API thinking/reasoning_content errors
        )
    
    def load_all_agents(self) -> Dict[str, AssistantAgent]:
        """
        Load all agent configurations from the specified directory.
        
        Returns:
            Dictionary mapping agent names to AssistantAgent instances
        """
        if self._agents:
            return self._agents
            
        # List all JSON files and sort them to maintain order
        json_files = sorted([f for f in os.listdir(self.config_dir) if f.endswith('.json')])
        
        for filename in json_files:
            filepath = os.path.join(self.config_dir, filename)
            agent = self.load_agent_from_json(filepath)
            self._agents[agent.name] = agent
            print(f"[AgentLoader] Loaded agent: {agent.name} from {filename}")
        
        return self._agents
    
    def get_agent(self, name: str) -> AssistantAgent:
        """Get a specific agent by name."""
        if not self._agents:
            self.load_all_agents()
        return self._agents.get(name)
    
    def get_ordered_agents(self) -> List[AssistantAgent]:
        """Get agents in their workflow order."""
        agents = self.load_all_agents()
        order = [
            "news_researcher",
            "editor", 
            "final_writer",
            "fact_checker",
            "recovery_researcher",
            "final_editor",
            "audio_producer"
        ]
        return [agents[name] for name in order if name in agents]


# Global loader instance
_agent_loader = None


def get_agent_loader() -> AgentLoader:
    """Get or create the global agent loader instance."""
    global _agent_loader
    if _agent_loader is None:
        _agent_loader = AgentLoader()
    return _agent_loader
