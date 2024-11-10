import logging
import sys
from typing import Optional

def setup_logging(level: Optional[int] = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('atlas.log')
        ]
    ) 