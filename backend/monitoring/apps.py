from __future__ import annotations

import os

from django.apps import AppConfig
from django.conf import settings


class MonitoringConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "monitoring"

    def ready(self) -> None:  # pragma: no cover
        # Avoid double-start under `runserver`'s autoreload (it forks).
        if os.environ.get("RUN_MAIN") != "true" and os.environ.get(
            "CSUCC_FORCE_AUTOSTART"
        ) != "1":
            return
        if not getattr(settings, "SIM_AUTOSTART", False):
            return
        # Defer import so app registry is fully loaded.
        from . import services

        try:
            services.ensure_seed_data()
            services.start_loop()
        except Exception as exc:  # pragma: no cover
            import logging

            logging.getLogger("csucc.boot").exception(
                "failed to autostart simulation loop: %s", exc
            )
