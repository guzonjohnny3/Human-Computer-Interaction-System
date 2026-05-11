"""DRF serializers for register / login / me / reset."""

from __future__ import annotations

import re

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import SECURITY_QUESTIONS, CSUCC_ID_RE, Role, UserProfile


INSTITUTIONAL_EMAIL_RE = re.compile(r"^[^@\s]+@csucc\.edu\.ph$", re.IGNORECASE)


class ProfileOut(serializers.ModelSerializer):
    csucc_id = serializers.CharField()
    first_name = serializers.CharField(source="user.first_name")
    middle_name = serializers.CharField()
    last_name = serializers.CharField(source="user.last_name")
    email = serializers.EmailField(source="user.email")
    role = serializers.CharField()
    username = serializers.CharField(source="user.username")
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "csucc_id",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "email",
            "role",
            "username",
        ]

    def get_full_name(self, obj: UserProfile) -> str:
        parts = [obj.user.first_name, obj.middle_name, obj.user.last_name]
        return " ".join([p for p in parts if p]).strip()


class RegisterSerializer(serializers.Serializer):
    csucc_id = serializers.CharField()
    first_name = serializers.CharField()
    middle_name = serializers.CharField(allow_blank=True, required=False, default="")
    last_name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Role.choices)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    security_q1 = serializers.ChoiceField(choices=[k for k, _ in SECURITY_QUESTIONS])
    security_a1 = serializers.CharField()
    security_q2 = serializers.ChoiceField(choices=[k for k, _ in SECURITY_QUESTIONS])
    security_a2 = serializers.CharField()

    def validate_csucc_id(self, value: str) -> str:
        if not CSUCC_ID_RE.match(value):
            raise serializers.ValidationError(
                "CSUCC ID must be in the format xxxxxx-xxxxxx (12 digits)."
            )
        if UserProfile.objects.filter(csucc_id=value).exists():
            raise serializers.ValidationError("That CSUCC ID is already registered.")
        return value

    def validate_email(self, value: str) -> str:
        if not INSTITUTIONAL_EMAIL_RE.match(value):
            raise serializers.ValidationError(
                "Email must be an institutional address ending in @csucc.edu.ph."
            )
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with that email already exists.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if attrs["security_q1"] == attrs["security_q2"]:
            raise serializers.ValidationError(
                {"security_q2": "Pick a different security question from the first one."}
            )
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated):
        user = User.objects.create_user(
            username=validated["email"].lower(),
            email=validated["email"].lower(),
            first_name=validated["first_name"],
            last_name=validated["last_name"],
            password=validated["password"],
            is_staff=validated["role"] == Role.ADMIN,
        )
        profile = UserProfile.objects.create(
            user=user,
            csucc_id=validated["csucc_id"],
            middle_name=validated.get("middle_name", ""),
            role=validated["role"],
            security_q1=validated["security_q1"],
            security_q2=validated["security_q2"],
            security_a1_hash="",
            security_a2_hash="",
        )
        profile.set_security_answers(validated["security_a1"], validated["security_a2"])
        profile.save()
        return profile


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        help_text="Either institutional email or CSUCC ID (xxxxxx-xxxxxx)."
    )
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        ident = attrs["identifier"].strip()
        pwd = attrs["password"]
        # Allow log-in by email or CSUCC ID.
        user = None
        if "@" in ident:
            user = authenticate(username=ident.lower(), password=pwd)
        else:
            try:
                profile = UserProfile.objects.select_related("user").get(csucc_id=ident)
                user = authenticate(username=profile.user.username, password=pwd)
            except UserProfile.DoesNotExist:
                pass
        if user is None:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class TokenOut(serializers.Serializer):
    token = serializers.CharField()
    profile = ProfileOut()


class SecurityResetSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    security_a1 = serializers.CharField()
    security_a2 = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        ident = attrs["identifier"].strip()
        try:
            if "@" in ident:
                user = User.objects.get(email__iexact=ident)
                profile = user.profile
            else:
                profile = UserProfile.objects.select_related("user").get(csucc_id=ident)
        except (User.DoesNotExist, UserProfile.DoesNotExist):
            raise serializers.ValidationError("No account found.")
        if not profile.check_security_answers(attrs["security_a1"], attrs["security_a2"]):
            raise serializers.ValidationError("Security answers do not match.")
        validate_password(attrs["new_password"])
        attrs["profile"] = profile
        return attrs


def issue_token(user) -> str:
    """Reuse or create a DRF Token for a user."""
    token, _ = Token.objects.get_or_create(user=user)
    return token.key
