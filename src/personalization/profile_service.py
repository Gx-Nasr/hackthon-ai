"""Profile services shared by HTTP routes and the campus chatbot."""

from .database import Database
from .models import ProfileInput, StudentProfile


def save_profile(database: Database, user_id: str, profile: ProfileInput) -> StudentProfile:
    if profile.user_id is not None and profile.user_id != user_id:
        raise ValueError("Body user_id must match the URL user_id")
    validated = StudentProfile.model_validate({**profile.model_dump(), "user_id": user_id})
    return database.save_student(validated)


def get_profile(database: Database, user_id: str) -> StudentProfile:
    profile = database.get_student(user_id)
    if profile is None:
        raise KeyError("Student not found")
    return profile
