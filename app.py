import os
import streamlit as st
from PIL import Image
from src.extractor import AnnouncementExtractor
from src.application import CampusApplication
from src.personalization.database import get_database
from src.advisor import ConflictDetector
from io import BytesIO
from src.calendar_gen import generate_ics_content
from src.gmail_sync import GmailEventSync

st.set_page_config(page_title="UniRadar | UM6P", layout="wide", page_icon="📡")

# Initialize modules
@st.cache_resource
def get_application():
    return CampusApplication(get_database())

campus = get_application()
advisor = ConflictDetector(campus.profile)
extractor = campus.extractor

st.title("📡 UniRadar: Campus Anti-Chaos Engine")
st.caption("Multimodal Edge Intelligence for UM6P (Rabat & Ben Guerir)")

tab1, tab2, tab3 = st.tabs(["📥 Drop Announcement (Vision/Text)", "🎯 Smart Radar Feed", "💬 Trilingual Campus Q&A"])

# TAB 1: Ingestion
with tab1:
    st.subheader("Multimodal Ingestion: Flyers, WhatsApp Forwards, Outlook Mails")
    input_type = st.radio("Source Format:", ["Poster Image (PNG/JPG)", "Email / Raw Text Message"], horizontal=True)

    if input_type == "Poster Image (PNG/JPG)":
        uploaded_file = st.file_uploader("Upload Event Poster", type=["png", "jpg", "jpeg"])
        if uploaded_file and st.button("Extract with Gemini Vision"):
            temp_path = BytesIO(uploaded_file.getvalue())

            col1, col2 = st.columns([1, 1])
            with col1:
                st.image(temp_path, caption="Uploaded Flyer", use_container_width=True)
            with col2:
                with st.spinner("Parsing layout, French/English text, and dates..."):
                    try:
                        parsed = extractor.extract_from_image(BytesIO(uploaded_file.getvalue()))
                        campus.add(parsed)
                    except Exception as error:
                        st.error(str(error))
                        st.stop()
                    st.success("Successfully Extracted and Indexed!")
                    st.json(parsed.model_dump(mode="json"))

    else:
        raw_text = st.text_area("Paste raw text from WhatsApp or Outlook:", height=180,
                                placeholder="Chers étudiants, l'association Forgebots organise ce samedi à 10h au College of Computing...")
        if st.button("Parse & Index Event") and raw_text.strip():
            with st.spinner("Extracting structure via Gemini..."):
                try:
                    parsed = extractor.extract_from_text(raw_text)
                    campus.add(parsed)
                except Exception as error:
                    st.error(str(error))
                    st.stop()
                st.success("Event added to local vector store!")
                st.json(parsed.model_dump(mode="json"))
    with st.expander("📬 Auto-Sync from Gmail"):
        st.caption("Automatically scan your inbox for hackathons and campus announcements.")
        email_account = st.text_input("Gmail Address", value="your_email@gmail.com")
        app_pwd = st.text_input("App Password (16-char)", type="password")
        
        if st.button("Sync & Ingest New Events") and email_account and app_pwd:
            with st.spinner("Connecting to inbox and evaluating emails with Gemini..."):
                syncer = GmailEventSync(email_account, app_pwd)
                new_events = syncer.fetch_and_filter_events(max_emails=5)
                
                if new_events:
                    for ev in new_events:
                        campus.add(ev)
                    st.success(f"Detected and added {len(new_events)} event(s) to your radar!")
                    st.json([ev.model_dump(mode="json") for ev in new_events])
                else:
                    st.info("No new hackathons or campus announcements detected in recent emails.")

# TAB 2: Live Radar Feed
with tab2:
    st.subheader("Your Personalized Campus Feed")
    announcements = campus.announcements()
    if not announcements:
        st.info("No events loaded yet. Upload a flyer or check sample announcements in data/.")
    else:
        scores = {e["id"]: e["relevanceScore"] for e in campus.feed()}
        for idx, ev in enumerate(announcements):
            eval_res = advisor.evaluate(ev)
            badge = eval_res.badge_type.value.upper()
            
            badge_icon = "🟢" if badge == "ACTIONABLE" else ("🟡" if badge == "CROSS_CAMPUS" else "🔴")
            
            with st.container():
                c1, c2, c3 = st.columns([4, 1, 1])
                with c1:
                    st.markdown(f"### {badge_icon} {ev.title} `[{ev.campus}]`")
                    st.write(f"**Location:** {ev.venue} | **Time:** {ev.start_datetime}")
                    st.write(ev.description)
                    st.info(f"💡 **Advisor Note:** {eval_res.explanation}")
                with c2:
                    st.metric("Match", f"{scores.get(ev.id, 0):.0f}%")
                    st.caption(f"Status: **{badge}**")
                with c3:
                    ics_data = generate_ics_content(ev)
                    st.download_button(
                        label="📅 Add to Calendar",
                        data=ics_data,
                        file_name=f"{ev.id}.ics",
                        mime="text/calendar",
                        key=f"ics_{idx}"
                    )
                st.divider()

# TAB 3: Multilingual Search
with tab3:
    st.subheader("Campus Memory Search (Darija, Français, English)")
    user_q = st.text_input("Ask anything:", placeholder="wach kayn chi hackathon f rabat had weekend? / any AI events this week?")
    
    if st.button("Search & Consult") and user_q:
        with st.spinner("Retrieving via MiniLM + BM25s and reasoning via Gemini..."):
            answer = campus.ask(user_q)
            st.markdown("### Answer:")
            st.write(answer.answer)
            for ev in answer.cited_announcements:
                st.download_button("📅 " + ev.title, generate_ics_content(ev), f"{ev.id}.ics", "text/calendar", key=f"chat_{ev.id}")
            
            with st.expander("Inspected Context Cards"):
                st.json([ev.model_dump(mode="json") for ev in answer.cited_announcements])
