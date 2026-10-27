import base64
from io import BytesIO
from threading import Lock
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import UnidentifiedImageError
from pydantic import ValidationError
from google.genai.errors import APIError

from src.application import CampusApplication
from src.calendar_gen import generate_ics_content
from src.models import StudentProfile
from src.personalization.database import get_database

router = APIRouter(prefix="/api")
_initialization_lock = Lock()


def get_campus(request: Request, database=Depends(get_database)):
    with _initialization_lock:
        if not hasattr(request.app.state, "campus"):
            request.app.state.campus = CampusApplication(database)
    return request.app.state.campus


def get_profile(x_student_profile: str | None = Header(default=None)):
    if not x_student_profile:
        return None
    try:
        return StudentProfile.model_validate_json(base64.b64decode(x_student_profile))
    except (ValueError, ValidationError):
        raise HTTPException(422, "Invalid student profile") from None


def extract_upload(campus, upload):
    payload = upload.file.read(12 * 1024 * 1024 + 1)
    if len(payload) > 12 * 1024 * 1024:
        raise HTTPException(413, "File must be at most 12 MB")
    if upload.content_type == "application/pdf":
        return campus.extractor.extract_from_pdf(payload)
    return campus.extractor.extract_from_image(BytesIO(payload))


@router.get("/events")
def events(campus=Depends(get_campus), profile=Depends(get_profile)):
    return {"events": campus.feed(profile)}


@router.post("/announcements")
def ingest(text: str = Form(default=""), file: UploadFile | None = File(default=None), campus=Depends(get_campus)):
    if not text.strip() and file is None:
        raise HTTPException(422, "Provide email text or a flyer image")
    try:
        announcement = extract_upload(campus, file) if file else campus.extractor.extract_from_text(text)
        campus.add(announcement)
    except (ValueError, UnidentifiedImageError) as error:
        return JSONResponse(status_code=422, content={"message": str(error)})
    except APIError:
        return JSONResponse(status_code=503, content={"message": "Gemini extraction is unavailable. Check your API key and quota, then retry."})
    return {"message": "Announcement extracted and indexed.", "demo": False, "announcement": announcement.model_dump(mode="json")}


@router.get("/events/{event_id}/calendar")
def calendar_download(event_id: str, campus=Depends(get_campus)):
    announcement = next((a for a in campus.announcements() if a.id == event_id), None)
    if announcement is None:
        raise HTTPException(404, "Announcement not found")
    return Response(generate_ics_content(announcement), media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="uniradar-event.ics"'})


@router.post("/chat")
def chat(message: str = Form(default=""), conversationId: str = Form(default=""),
         images: list[UploadFile] = File(default=[]), campus=Depends(get_campus), profile=Depends(get_profile)):
    if not message.strip() and not images:
        raise HTTPException(422, "Provide a question or image")
    try:
        for image in images:
            announcement = campus.add(extract_upload(campus, image))
            if not message.strip():
                message = announcement.title
        answer = campus.ask(message, profile)
    except (ValueError, UnidentifiedImageError) as error:
        return JSONResponse(status_code=422, content={"message": str(error)})
    except APIError:
        return JSONResponse(status_code=503, content={"message": "Gemini extraction is unavailable. Check your API key and quota, then retry."})
    sources = [{"title": a.title, "url": a.registration_url} for a in answer.cited_announcements]
    # Reuse the existing citation links for one-click server-generated calendars.
    sources += [{"title": f"📅 {a.title} (.ics)", "url": f"/api/events/{a.id}/calendar"}
                for a in answer.cited_announcements]
    return {"conversationId": conversationId or uuid4().hex, "message": answer.answer,
            "sources": sources, "demo": False}
