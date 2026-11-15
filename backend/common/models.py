"""Abstract base models shared by the domain apps (DRY: most tables carry `created_at`)."""
from django.db import models


class CreatedAtModel(models.Model):
    """Adds an immutable creation timestamp."""

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class TimeStampedModel(CreatedAtModel):
    """Adds creation and last-update timestamps, for rows that are edited after creation."""

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
