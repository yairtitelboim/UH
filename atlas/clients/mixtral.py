import os

class MixtralClient:
    def __init__(self):
        self.api_key = os.getenv('MIXTRAL_API_KEY')
        if not self.api_key:
            raise ValueError("MIXTRAL_API_KEY not found in environment variables") 