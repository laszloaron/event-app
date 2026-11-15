"""Write the API's OpenAPI schema to a file, for generating the frontend's TypeScript types.

Ninja ships `export_openapi_schema`, but Django only finds it when "ninja" is in
INSTALLED_APPS, which settings.py avoids on purpose (Swagger UI loads from CDN, no static
files). This command does the same in a few lines.
"""
import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.core.serializers.json import DjangoJSONEncoder

from config.api import api


class Command(BaseCommand):
    """`manage.py export_openapi --output <path>`."""

    help = "Export the /api/v1 OpenAPI schema as JSON."

    def add_arguments(self, parser: CommandParser) -> None:
        """Register the `--output` option."""
        parser.add_argument("--output", required=True, help="File to write the JSON schema to.")

    def handle(self, *args: Any, **options: Any) -> None:
        """Build the schema with full `/api/v1/...` paths and write it as sorted, indented JSON.

        Sorted keys keep the committed file's diff stable between exports.
        `DjangoJSONEncoder` turns lazy model labels (verbose names, choice labels) into str.
        """
        schema = api.get_openapi_schema()
        output = Path(options["output"])
        text = json.dumps(schema, indent=2, sort_keys=True, cls=DjangoJSONEncoder)
        output.write_text(text + "\n", encoding="utf-8")
        self.stdout.write(f"Wrote {len(schema['paths'])} paths to {output}")
