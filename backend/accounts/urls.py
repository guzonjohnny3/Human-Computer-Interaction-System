from django.urls import path

from . import views

urlpatterns = [
    path("auth/security-questions/", views.security_questions, name="auth-questions"),
    path("auth/register/", views.register, name="auth-register"),
    path("auth/login/", views.login, name="auth-login"),
    path("auth/logout/", views.logout, name="auth-logout"),
    path("auth/me/", views.me, name="auth-me"),
    path("auth/lookup-security/", views.lookup_security, name="auth-lookup-security"),
    path("auth/reset/", views.reset_password, name="auth-reset"),
]
