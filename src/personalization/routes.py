"""Import `router` into the team's application; the /api prefix is already included."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .database import Database, get_database
from .event_importer import EventImportError, import_events
from .models import Identifier, ImportSummary, ProfileInput, RankRequest, RecommendationResponse, StudentProfile
from .profile_service import get_profile, save_profile
from .recommender import Recommender

router = APIRouter(prefix="/api", tags=["personalization"])
Repository = Annotated[Database, Depends(get_database)]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "uniradar-personalization"}


@router.put("/profiles/{user_id}", response_model=StudentProfile)
def put_profile(user_id: Identifier, profile: ProfileInput, database: Repository) -> StudentProfile:
    try:
        return save_profile(database, user_id, profile)
    except ValueError:
        raise HTTPException(status_code=422, detail="Body user_id must match the URL user_id") from None


@router.get("/profiles/{user_id}", response_model=StudentProfile)
def read_profile(user_id: Identifier, database: Repository) -> StudentProfile:
    try:
        return get_profile(database, user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Student not found") from None


@router.post("/personalization/events/sync", response_model=ImportSummary)
def sync_events(database: Repository) -> ImportSummary:
    try:
        return import_events(database)
    except EventImportError as error:
        raise HTTPException(status_code=400, detail=str(error)) from None


@router.get("/recommendations/{user_id}", response_model=RecommendationResponse)
def recommendations(
    user_id: Identifier, database: Repository,
    limit: Annotated[int | None, Query(ge=1, le=500)] = None,
) -> RecommendationResponse:
    try:
        return Recommender(database).recommend(user_id, limit=limit)
    except KeyError:
        raise HTTPException(status_code=404, detail="Student not found") from None


@router.post("/recommendations/rank", response_model=RecommendationResponse)
def rank_events(request: RankRequest, database: Repository) -> RecommendationResponse:
    return Recommender(database).rank(request.profile, request.events, limit=request.limit)
