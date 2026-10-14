import json
import os
import sys
import urllib.request

from bridge_protocol import health_ready

try:
    url = os.environ.get("EGS_PROXY_HEALTH_URL", "http://127.0.0.1:8080/__relay_health")
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.load(response)
    sys.exit(0 if health_ready(data) else 1)
except Exception:
    sys.exit(1)
