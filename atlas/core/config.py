import os
from dataclasses import dataclass
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

@dataclass
class AIConfig:
    tavily_api_key: Optional[str] = os.getenv('TAVILY_API_KEY')
    claude_api_key: Optional[str] = os.getenv('CLAUDE_API_KEY')
    openai_api_key: Optional[str] = os.getenv('OPENAI_API_KEY')
    serpapi_api_key: Optional[str] = os.getenv('SERPAPI_API_KEY')
    perplexity_api_key: Optional[str] = os.getenv('PR_API')
    unstructured_api_key: Optional[str] = os.getenv('UNSTRUCTURED_API_KEY')
    serper_api_key: Optional[str] = os.getenv('SERPER_API_KEY')
    
    @classmethod
    def from_env(cls):
        load_dotenv()
        return cls(
            tavily_api_key=os.getenv('TAVILY_API_KEY'),
            claude_api_key=os.getenv('CLAUDE_API_KEY'),
            openai_api_key=os.getenv('OPENAI_API_KEY'),
            serpapi_api_key=os.getenv('SERPAPI_API_KEY'),
            perplexity_api_key=os.getenv('PR_API'),
            unstructured_api_key=os.getenv('UNSTRUCTURED_API_KEY'),
            serper_api_key=os.getenv('SERPER_API_KEY')
        ) 