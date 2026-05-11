"""CSUCC user profile extension.

Adds CSUCC-specific fields to Django's auth User without replacing the
built-in user model (so we don't have to reset the schema):
- csucc_id   xxxxxx-xxxxxx (12 digits with dash)
- middle_name (optional)
- role       Admin / Staff
- 2 × security question/answer pairs (hashed)

The institutional email constraint (@csucc.edu.ph) is enforced in the
serializer, not the model, because Django's User.email is already declared
elsewhere.
"""

from __future__ import annotations

import re
from typing import ClassVar

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models


CSUCC_ID_RE = re.compile(r"^\d{6}-\d{6}$")

# Predefined security question prompts.
SECURITY_QUESTIONS: tuple[tuple[str, str], ...] = (
    ("mother_maiden", "What is your mother's maiden name?"),
    ("first_pet", "What was the name of your first pet?"),
    ("elementary_school", "What elementary school did you attend?"),
    ("favorite_teacher", "Who was your favorite teacher?"),
    ("birth_city", "In what city were you born?"),
)


def _validate_csucc_id(value: str) -> None:
    if not CSUCC_ID_RE.match(value):
        raise ValidationError("CSUCC ID must be in the format xxxxxx-xxxxxx (12 digits).")


class Role(models.TextChoices):
    ADMIN = "Admin", "Admin"
    STAFF = "Staff", "Staff"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    csucc_id = models.CharField(
        max_length=13,
        unique=True,
        validators=[_validate_csucc_id],
        help_text="xxxxxx-xxxxxx",
    )
    middle_name = models.CharField(max_length=64, blank=True, default="")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)

    security_q1 = models.CharField(max_length=64, choices=SECURITY_QUESTIONS)
    security_a1_hash = models.CharField(max_length=256)
    security_q2 = models.CharField(max_length=64, choices=SECURITY_QUESTIONS)
    security_a2_hash = models.CharField(max_length=256)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    SECURITY_QUESTIONS: ClassVar = SECURITY_QUESTIONS

    class Meta:
        ordering = ["user__last_name", "user__first_name"]

    def __str__(self) -> str:
        return f"{self.user.get_full_name() or self.user.username} ({self.role})"

    def set_security_answers(self, a1: str, a2: str) -> None:
        self.security_a1_hash = make_password(a1.strip().lower())
        self.security_a2_hash = make_password(a2.strip().lower())

    def check_security_answers(self, a1: str, a2: str) -> bool:
        ok1 = check_password(a1.strip().lower(), self.security_a1_hash)
        ok2 = check_password(a2.strip().lower(), self.security_a2_hash)
        return ok1 and ok2
