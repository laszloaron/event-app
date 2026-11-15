"""Root URL configuration. nginx forwards every /api/* request here."""
from django.urls import path

from config.api import api
from config.health import health

urlpatterns = [
    path("api/health", health, name="health"),
    path("api/v1/", api.urls),
]
