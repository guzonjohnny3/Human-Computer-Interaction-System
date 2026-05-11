"""Auth REST endpoints: register / login / logout / me / reset / questions."""

from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)

from .auth_xheader import XHeaderTokenAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import SECURITY_QUESTIONS, UserProfile
from .serializers import (
    LoginSerializer,
    ProfileOut,
    RegisterSerializer,
    SecurityResetSerializer,
    issue_token,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def security_questions(_request) -> Response:
    return Response([{"key": k, "label": v} for k, v in SECURITY_QUESTIONS])


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request) -> Response:
    ser = RegisterSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    profile = ser.save()
    token = issue_token(profile.user)
    return Response(
        {"token": token, "profile": ProfileOut(profile).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request) -> Response:
    ser = LoginSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.validated_data["user"]
    token = issue_token(user)
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return Response(
            {"detail": "User has no CSUCC profile. Contact administrator."},
            status=403,
        )
    return Response({"token": token, "profile": ProfileOut(profile).data})


@api_view(["POST"])
@authentication_classes([XHeaderTokenAuthentication])
@permission_classes([IsAuthenticated])
def logout(request) -> Response:
    request.user.auth_token.delete()
    return Response({"ok": True})


@api_view(["GET"])
@authentication_classes([XHeaderTokenAuthentication])
@permission_classes([IsAuthenticated])
def me(request) -> Response:
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        return Response({"detail": "no profile"}, status=403)
    return Response(ProfileOut(profile).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def lookup_security(request) -> Response:
    """Step 1 of password reset — find which security questions the user has."""
    identifier = (request.data.get("identifier") or "").strip()
    if not identifier:
        return Response({"detail": "identifier required"}, status=400)
    try:
        if "@" in identifier:
            from django.contrib.auth.models import User

            user = User.objects.get(email__iexact=identifier)
            profile = user.profile
        else:
            profile = UserProfile.objects.select_related("user").get(csucc_id=identifier)
    except Exception:
        # Don't leak which side failed.
        return Response({"detail": "No account found."}, status=404)

    qmap = dict(SECURITY_QUESTIONS)
    return Response(
        {
            "question_1": {"key": profile.security_q1, "label": qmap[profile.security_q1]},
            "question_2": {"key": profile.security_q2, "label": qmap[profile.security_q2]},
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request) -> Response:
    ser = SecurityResetSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    profile = ser.validated_data["profile"]
    profile.user.set_password(ser.validated_data["new_password"])
    profile.user.save(update_fields=["password"])
    # invalidate any existing tokens
    profile.user.auth_token_set.all().delete() if hasattr(profile.user, "auth_token_set") else None
    return Response({"ok": True})
