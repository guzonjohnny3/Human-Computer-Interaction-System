"""FastAPI entry point that wraps the Django WSGI app.

This exists solely so the deploy tool — which expects a FastAPI ASGI
application — can stand up the Django backend with its simulation loop,
migrations, and REST endpoints unchanged.
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "csucc_backend.settings")
os.environ.setdefault("DJANGO_DEBUG", "0")
os.environ.setdefault("DJANGO_ALLOWED_HOSTS", "*")
sys.path.insert(0, str(BASE_DIR))

import django  # noqa: E402

django.setup()

from a2wsgi import WSGIMiddleware  # noqa: E402
from django.core.wsgi import get_wsgi_application  # noqa: E402
from fastapi import FastAPI  # noqa: E402


def _run_migrations() -> None:
    """Apply migrations + collect static files. Called on lifespan startup."""
    import subprocess

    subprocess.run(
        [sys.executable, str(BASE_DIR / "manage.py"), "migrate", "--noinput"],
        check=False,
    )
    subprocess.run(
        [
            sys.executable,
            str(BASE_DIR / "manage.py"),
            "collectstatic",
            "--noinput",
        ],
        check=False,
    )


def _boot_simulation() -> None:
    """Seed data + start the simulation loop on a real thread.

    Running inside a thread avoids Django's `SynchronousOnlyOperation`
    block when the WSGI/ASGI server boots up.
    """
    import logging
    import threading
    import time

    def _runner() -> None:
        time.sleep(0.5)
        try:
            from monitoring import services

            services.ensure_seed_data()
            services.start_loop()
        except Exception:  # pragma: no cover
            logging.getLogger("csucc.boot").exception(
                "failed to autostart simulation loop"
            )

    threading.Thread(target=_runner, name="csucc-boot", daemon=True).start()


@asynccontextmanager
async def lifespan(_: FastAPI):
    _run_migrations()
    _boot_simulation()
    yield


django_app = get_wsgi_application()
app = FastAPI(title="CSUCC Smart Restroom Backend", lifespan=lifespan)
app.mount("/", WSGIMiddleware(django_app))
