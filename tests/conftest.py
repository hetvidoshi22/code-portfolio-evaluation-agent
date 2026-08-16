"""Make the repository root and the api/ package directory importable."""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, "api")

for path in (API, ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)
