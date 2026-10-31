import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Default Meko to disabled in test suite to prevent real network calls during general unit tests
os.environ.setdefault("MEKO_ENABLED", "false")
