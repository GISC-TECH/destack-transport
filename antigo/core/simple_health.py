from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
import time

@csrf_exempt
@require_http_methods(["GET", "HEAD"])
def simple_health(request):
    """
    Simple health check without middleware interference
    """
    return JsonResponse({
        "status": "healthy",
        "timestamp": int(time.time()),
        "message": "Django is running"
    })