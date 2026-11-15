"""Django settings for EventMap.

All environment-specific values come from environment variables (see `.env.example`),
so the same image runs in every environment.
"""
import os
from pathlib import Path

from config.logging_config import build_logging_config

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_list(name: str, default: str = "") -> list[str]:
    """Read a comma-separated environment variable as a list of non-empty strings."""
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = _env_list("ALLOWED_HOSTS", "localhost")
CSRF_TRUSTED_ORIGINS = _env_list("CSRF_TRUSTED_ORIGINS")

# No django.contrib.admin: nginx only routes /api/*, and moderation is done through the API (US-17..21).
# "ninja" is deliberately not installed as an app, so Swagger UI loads from CDN and needs no static files.
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.gis",
    "common",
    "accounts",
    "events",
    "inbox",
    "moderation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": os.environ.get("POSTGRES_HOST", "db"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# All times are stored in UTC; events carry their own venue timezone (architecture.md §4).
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Single launch city (specification.md: one launch region, e.g. Budapest).
EVENTMAP_DEFAULT_TIMEZONE = "Europe/Budapest"

# Session-cookie auth on a single origin (architecture.md §1). The SPA must read the CSRF
# cookie to send it back as a header, so that cookie cannot be httpOnly.
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
# nginx terminates the client connection; trust its scheme header once HTTPS is added.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

LOGGING = build_logging_config(os.environ.get("LOG_LEVEL", "INFO"))
