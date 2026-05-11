"""Custom DRF authentication that reads tokens from `X-Auth-Token`.

The standard Authorization header is reserved for the tunnel's Basic auth
when the dev backend is exposed via devinapps. This authenticator lets the
frontend send the DRF token on a separate header so both can coexist.
"""

from __future__ import annotations

from rest_framework.authentication import TokenAuthentication


class XHeaderTokenAuthentication(TokenAuthentication):
    keyword = "Token"

    def authenticate(self, request):
        # Try the standard Authorization: Token <key> path first.
        result = super().authenticate(request)
        if result is not None:
            return result
        raw = request.META.get("HTTP_X_AUTH_TOKEN", "")
        if not raw:
            return None
        return self.authenticate_credentials(raw.strip())
