"""Standalone entry point: uvicorn main:app --reload."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.personalization.database import Database, get_database
from src.personalization.routes import router


def create_app(database: Database | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if database is None:
            get_database()
        else:
            database.initialize_database()
        yield

    application = FastAPI(title="UniRadar Personalization", version="1.0.0", lifespan=lifespan)
    if database is not None:
        application.dependency_overrides[get_database] = lambda: database
    application.include_router(router)
    return application


app = create_app()
