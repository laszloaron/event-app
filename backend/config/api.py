"""Root Django Ninja API, served under /api/v1.

Domain routers (accounts, events, inbox, moderation) are mounted here as their
user stories are implemented.
"""
from ninja import NinjaAPI

api = NinjaAPI(title="EventMap API", version="1")
