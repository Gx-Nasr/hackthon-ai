"""
UniRadar Multimodal Extractor Contract & Helpers
Used by Backend 1 for extracting structured Announcements from flyers, PDFs, and emails.
Provides unified loaders and conversion utilities.
"""

from __future__ import annotations
import os
import json
from typing import List, Optional, Dict, Any
from datetime import datetime

from src.models import Announcement


def load_announcements_from_file(json_path: str = "data/sample_announcements.json") -> List[Announcement]:
    """Loads announcements from a structured JSON file."""
    if not os.path.exists(json_path):
        return []

    with open(json_path, "r", encoding="utf-8") as f:
        raw_items = json.load(f)

    announcements: List[Announcement] = []
    for item in raw_items:
        # Convert string datetime to datetime object if needed
        if isinstance(item.get("start_datetime"), str):
            item["start_datetime"] = datetime.fromisoformat(item["start_datetime"])
        if item.get("end_datetime") and isinstance(item.get("end_datetime"), str):
            item["end_datetime"] = datetime.fromisoformat(item["end_datetime"])
        announcements.append(Announcement(**item))

    return announcements


def save_announcements_to_file(
    announcements: List[Announcement],
    json_path: str = "data/sample_announcements.json"
) -> None:
    """Saves announcement models to JSON file with ISO formatted datetimes."""
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    serialized = []
    for ann in announcements:
        data = ann.model_dump()
        data["start_datetime"] = ann.start_datetime.isoformat()
        if ann.end_datetime:
            data["end_datetime"] = ann.end_datetime.isoformat()
        serialized.append(data)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(serialized, f, indent=2, ensure_ascii=False)
