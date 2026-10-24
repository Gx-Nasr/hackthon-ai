import os
import streamlit as st
from PIL import Image
from src.extractor import AnnouncementExtractor
from src.retriever import HybridCampusRetriever
from src.advisor import CampusAdvisor
from src.calendar_gen import generate_ics_content
from src.gmail_sync import GmailEventSync

st.set_page_config(page_title="UniRadar | UM6P", layout="wide", page_icon="📡")

# Initialize modules
retriever = HybridCampusRetriever()
advisor = CampusAdvisor()
extractor = AnnouncementExtractor()

st.title("📡 UniRadar: Campus Anti-Chaos Engine")
st.caption("Multimodal Edge Intelligence for UM6P (Rabat & Ben Guerir)")

tab1, tab2, tab3 = st.tabs(["📥 Drop Announcement (Vision/Text)", "🎯 Smart Radar Feed", "💬 Trilingual Campus Q&A"])

# TAB 1: Ingestion
with tab1:
    st.subheader("Multimodal Ingestion: Flyers, WhatsApp Forwards, Outlook Mails")
    input_type = st.radio("Source Format:", ["Poster Image (PNG/JPG)", "Email / Raw Text Message"], horizontal=True)

    if input_type == "Poster Image (PNG/JPG)":
        uploaded_file = st.file_uploader("Upload Event Poster", type=["png", "jpg", "jpeg"])
        if uploaded_file and st.button("Extract with Gemma 4 Vision"):
            temp_path = f"data/sample_posters/{uploaded_file.name}"
            os.makedirs("data/sample_posters", exist_ok=True)
            with open(temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())

            col1, col2 = st.columns([1, 1])
            with col1:
                st.image(temp_path, caption="Uploaded Flyer", use_container_width=True)
            with col2:
                with st.spinner("Gemma 4 parsing layout, French/English text, and relative dates..."):
                    parsed = extractor.extract_from_image(temp_path)
                    retriever.add_event(parsed)
                    st.success("Successfully Extracted and Indexed!")
                    st.json(parsed)

    else:
        raw_text = st.text_area("Paste raw text from WhatsApp or Outlook:", height=180,
                                placeholder="Chers étudiants, l'association Forgebots organise ce samedi à 10h au College of Computing...")
        if st.button("Parse & Index Event") and raw_text.strip():
            with st.spinner("Extracting structure via Gemma 4..."):
                parsed = extractor.extract_from_text(raw_text)
                retriever.add_event(parsed)
                st.success("Event added to local vector store!")
                st.json(parsed)
    with st.expander("📬 Auto-Sync from Gmail"):
        st.caption("Automatically scan your inbox for hackathons and campus announcements.")
        email_account = st.text_input("Gmail Address", value="your_email@gmail.com")
        app_pwd = st.text_input("App Password (16-char)", type="password")
        
        if st.button("Sync & Ingest New Events") and email_account and app_pwd:
            with st.spinner("Connecting to inbox and evaluating emails with Gemma 4..."):
                syncer = GmailEventSync(email_account, app_pwd)
                new_events = syncer.fetch_and_filter_events(max_emails=5)
                
                if new_events:
                    for ev in new_events:
                        retriever.add_event(ev)
                    st.success(f"Detected and added {len(new_events)} event(s) to your radar!")
                    st.json(new_events)
                else:
                    st.info("No new hackathons or campus announcements detected in recent emails.")

# TAB 2: Live Radar Feed
with tab2:
    st.subheader("Your Personalized Campus Feed")
    if not retriever.events:
        st.info("No events loaded yet. Upload a flyer or check sample announcements in data/.")
    else:
        for idx, ev in enumerate(retriever.events):
            eval_res = advisor.evaluate_event(ev)
            badge = eval_res.get("badge", "ACTIONABLE")
            
            badge_icon = "🟢" if badge == "ACTIONABLE" else ("🟡" if badge == "CROSS_CAMPUS" else "🔴")
            
            with st.container():
                c1, c2, c3 = st.columns([4, 1, 1])
                with c1:
                    st.markdown(f"### {badge_icon} {ev.get('title')} `[{ev.get('campus')}]`")
                    st.write(f"**Location:** {ev.get('location_details')} | **Time:** {ev.get('date')} {ev.get('start_time') or ''}")
                    st.write(ev.get("summary"))
                    st.info(f"💡 **Advisor Note:** {eval_res.get('advisor_note')}")
                with c2:
                    st.metric("Match", f"{eval_res.get('match_score', 80)}%")
                    st.caption(f"Status: **{badge}**")
                with c3:
                    ics_data = generate_ics_content(ev)
                    st.download_button(
                        label="📅 Add to Calendar",
                        data=ics_data,
                        file_name=f"{ev.get('title', 'event')}.ics",
                        mime="text/calendar",
                        key=f"ics_{idx}"
                    )
                st.divider()

# TAB 3: Multilingual Search
with tab3:
    st.subheader("Campus Memory Search (Darija, Français, English)")
    user_q = st.text_input("Ask anything:", placeholder="wach kayn chi hackathon f rabat had weekend? / any AI events this week?")
    
    if st.button("Search & Consult") and user_q:
        with st.spinner("Retrieving via MiniLM + BM25s and reasoning via Gemma 4..."):
            matched_events = retriever.search(user_q, top_k=3)
            answer = advisor.answer_query(user_q, matched_events)
            st.markdown("### Answer:")
            st.write(answer)
            
            with st.expander("Inspected Context Cards"):
                st.json(matched_events)