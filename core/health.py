from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
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
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = f"error: {str(e)}"
    
    try:
        # Check cache (Redis) if configured
        cache.set("health_check", "ok", 10)
        if cache.get("health_check") == "ok":
            health_status["checks"]["cache"] = "ok"
        else:
            health_status["checks"]["cache"] = "error: cache test failed"
    except Exception as e:
        # Cache might not be configured, which is ok
        health_status["checks"]["cache"] = "not_configured"
    
    status_code = 200 if health_status["status"] == "healthy" else 503
    return JsonResponse(health_status, status=status_code)