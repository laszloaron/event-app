# Pinned Debian release so the apt package set below stays reproducible. Trixie ships
# GDAL >= 3.9, which Django needs to block file/network access from spatial input (gis.W001).
FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# GeoDjango loads GDAL/GEOS/PROJ through ctypes at runtime; gdal-bin pulls in all three
# shared libraries. No -dev headers: nothing is compiled against them (docs/architecture.md §1).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
