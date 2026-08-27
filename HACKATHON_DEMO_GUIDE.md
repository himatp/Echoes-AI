# Echoes AI — Hackathon Presentation & Live Demo Playbook

Welcome to the **Echoes AI** Hackathon Demo Guide for GLS Nexus 2026. This guide provides a step-by-step walkthrough for demonstrating Echoes AI to judges.

---

## 🚀 Recommended 3-Minute Live Demo Flow

### 1. Introduction & Executive Dashboard (`http://localhost:3000`)
- **Key Point**: Explain that Echoes AI is an autonomous meeting intelligence engine that bridges the gap between raw conversation and actionable execution.
- **Showcase**: Highlight the real-time velocity progress bar, active tasks count, and overall team productivity metrics.

### 2. Live Mic Audio Diarization & Gemini 3.5 Flash Processing (`http://localhost:3000/new-meeting`)
- **Action**: Click **"Start Live Recording"**, grant mic access, and speak for 10-15 seconds (e.g. *"Sarah will verify the Gemini JSON schema parameters, and Alex will wire the AssemblyAI audio diarization endpoint by Friday"*).
- **Showcase**: Point out **Pipeline Step 1 (AssemblyAI-Diarization-Real)** uploading audio to CDN and returning real speaker turns (`Speaker A`, `Speaker B`).
- **Showcase**: Point out **Pipeline Step 2 (Gemini-3.5-Flash-Structured-JSON)** extracting executive summary, key decisions, and structured action items with real-time relative date calculation (`by Friday` $\rightarrow$ `2026-08-21`).

### 3. Interactive Meeting Hub & Speaker Timestamp Seeking (`http://localhost:3000/meetings/demo-1`)
- **Action**: Click any speaker timestamp (e.g., `[00:45] Alex Kumar`) in the Diarized Speaker Transcript timeline.
- **Showcase**: Notice how the player UI automatically seeks to that exact timestamp with animated active speaker highlight pills.
- **Showcase**: Highlight the **Dynamic Meeting Health Score (93/100)** computed dynamically from talk-time balance, decision density, and unassigned penalties.

### 4. 1-Click Google Calendar Event Sync & Resend Email Digest
- **Action**: On any action item card, click **"Sync to Google Calendar"**.
- **Showcase**: OAuth consent flow redirects or directly creates a real Google Calendar event on your primary calendar!
- **Action**: Click **"Send Email Digest"**, enter your email, and click **"Send Digest Email"**.
- **Showcase**: Show real Resend HTTP 200 response ID and check your inbox for a beautifully formatted HTML digest email!

### 5. PDF & DOCX Formatted Document Exports
- **Action**: Click **"Download PDF"** and **"Download DOCX"**.
- **Showcase**: Open the downloaded files directly to show formatted headers, speaker turn attributions, and task tables.

---

## 🛠️ Pre-Presentation Setup Checklist (Run 10 Minutes Before Demo)

1. **Verify Local Dev Server**:
   Ensure Next.js is running on port 3000:
   ```bash
   npm run dev
   ```
2. **Refresh Google OAuth Authorization**:
   - Open `http://localhost:3000/api/calendar/auth?returnTo=/meetings/demo-1` in your browser.
   - Select your test Google account and grant calendar permissions so your OAuth access token is fresh (prevents the 60-minute token expiry issue during the demo).

3. **Database & API Key Verification**:
   - `ASSEMBLYAI_API_KEY`: Real audio diarization active.
   - `GEMINI_API_KEY`: Google AI Studio key (`AIzaSy...`) active for Gemini 3.5 Flash JSON extraction.
   - `NEXT_PUBLIC_SUPABASE_URL`: Connected to `mltorzclmsxmhloslpzn.supabase.co` with `public.meetings` and `public.action_items` tables.
   - `RESEND_API_KEY`: Connected to `api.resend.com` for real HTML email dispatch.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Connected for 1-click Google Calendar sync.

---

## ⚖️ Architectural Highlights for Judges

- **Dual-Engine Pipeline**: AssemblyAI handles audio-to-text speaker diarization before text is passed to Gemini 3.5 Flash structured JSON mode.
- **Dynamic Multi-Factor Health Score**:
  $$\text{Score} = 0.45 \times \text{TalkBalance} + 0.45 \times \text{DecisionDensity} + 10 - \text{UnassignedPenalty}$$
- **Multi-Language Normalization**: Translates Gujarati, Hindi, or non-English speech into English summary and tasks while retaining original language metadata.
- **Cross-Meeting Task Memory**: Tracks uncompleted tasks across past meetings and automatically tags carried-over action items (`isCarriedOver: true`).
