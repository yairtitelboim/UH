from typing import Optional
from dataclasses import dataclass
from atlas.core.config import AIConfig

@dataclass
class ConfigValidation:
    is_valid: bool
    missing_keys: list[str]
    invalid_keys: list[str]
    message: str

def validate_config(config: AIConfig) -> ConfigValidation:
    required_keys = {
        'tavily_api_key': config.tavily_api_key,
        'claude_api_key': config.claude_api_key,
        'openai_api_key': config.openai_api_key,
        'mixtral_api_key': config.mixtral_api_key,
        'perplexity_api_key': config.perplexity_api_key
    }
    
    missing = [k for k, v in required_keys.items() if not v]
    invalid = [k for k, v in required_keys.items() if v and len(v) < 32]
    
    return ConfigValidation(
        is_valid=len(missing) == 0 and len(invalid) == 0,
        missing_keys=missing,
        invalid_keys=invalid,
        message=f"Missing keys: {missing}, Invalid keys: {invalid}" if missing or invalid else "Valid configuration"
    ) 