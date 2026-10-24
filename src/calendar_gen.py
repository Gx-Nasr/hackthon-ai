from datetime import datetime

def generate_ics_content(event: dict) -> str:
    title = event.get("title", "Campus Event")
    location = f"{event.get('location_details', '')}, {event.get('campus', '')}"
    summary = event.get("summary", "")
    date_str = event.get("date", datetime.now().strftime("%Y-%m-%d")).replace("-", "")
    
    start_t = (event.get("start_time") or "09:00").replace(":", "") + "00"
    end_t = (event.get("end_time") or "11:00").replace(":", "") + "00"
    
    dtstart = f"{date_str}T{start_t}"
    dtend = f"{date_str}T{end_t}"

    ics_template = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//UniRadar//UM6P Campus Engine//EN
BEGIN:VEVENT
SUMMARY:{title}
DESCRIPTION:{summary}
LOCATION:{location}
DTSTART:{dtstart}
DTEND:{dtend}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
    return ics_template