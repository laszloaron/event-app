"""Tests for the unversioned /api/health probe."""
from unittest import mock

from django.db import OperationalError
from django.test import TestCase


class HealthEndpointTests(TestCase):
    def test_health_ok_when_database_answers(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

    def test_health_503_when_database_unavailable(self) -> None:
        with mock.patch("config.health.connection.cursor", side_effect=OperationalError("down")):
            with self.assertLogs("config.health", level="WARNING"):
                response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "error", "database": "unavailable"})
