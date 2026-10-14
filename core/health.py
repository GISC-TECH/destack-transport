from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import time

@csrf_exempt
@require_http_methods(["GET", "HEAD"])
def health_check(request):
    """
    Health check endpoint for Docker/Kubernetes
    """
    health_status = {
        "status": "healthy",
        "timestamp": int(time.time()),
        "checks": {}
    }
    
    try:
        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            health_status["checks"]["database"] = "ok"
    except Exception:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = "error"
    
    try:
        # Check cache (Redis) if configured
        cache.set("health_check", "ok", 10)
        if cache.get("health_check") == "ok":
            health_status["checks"]["cache"] = "ok"
        else:
            health_status["status"] = "unhealthy"
            health_status["checks"]["cache"] = "error: cache test failed"
    except Exception:
        health_status["status"] = "unhealthy"
        health_status["checks"]["cache"] = "error"

    if getattr(settings, "MINIO_ENABLED", False):
        try:
            # exists() executa uma chamada autenticada e nao cria objetos.
            default_storage.exists(".destack-healthcheck")
            health_status["checks"]["storage"] = "ok"
        except Exception:
            health_status["status"] = "unhealthy"
            health_status["checks"]["storage"] = "error"
    else:
        health_status["checks"]["storage"] = "disabled"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JsonResponse(health_status, status=status_code)
