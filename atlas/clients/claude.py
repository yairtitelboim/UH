import anthropic
import logging
from typing import Dict
from ..core.config import AIConfig

logger = logging.getLogger(__name__)

class ClaudeClient:
    def __init__(self, config: AIConfig):
        self.client = anthropic.Client(api_key=config.claude_api_key)
    
    async def generate(self, context: Dict) -> str:
        try:
            response = await self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=4096,
                temperature=0.0,
                system="You are an expert CRE analyst. Analyze the provided property data and generate insights.",
                messages=[{
                    "role": "user",
                    "content": str(context)
                }]
            )
            return response.content
        except Exception as e:
            logger.error(f"Claude generation error: {e}")
            return "" 