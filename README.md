# Echoes — AI-Powered Meeting Notes & Task Generator

Echoes transforms live and uploaded meeting audio into structured notes, speaker-attributed transcripts, actionable tasks, and real-time meeting health metrics. Built with Next.js 14, Supabase, Google Gemini, and AssemblyAI, Echoes bridges the gap between raw conversation and actionable team execution.

---

## Overview

Echoes addresses meeting fatigue and lost action items by automatically capturing conversations, performing multi-speaker diarization, and extracting intelligence with generative AI. Meetings are converted into structured summaries, key decisions, prioritized tasks, sentiment analysis, and a dynamic Meeting Health Score. Users can export results directly to PDF or DOCX, synchronize action items to Google Calendar, dispatch automated email digests to team members, and manage tasks across organizations in a Kanban workspace.

---

## Key Features

- **Live & Uploaded Audio Processing**: Record directly in-browser or upload meeting audio files (`.mp3`, `.wav`, `.m4a`, `.webm`).
- **Speaker Diarization**: Automatic speaker identification and timestamped transcript segmentation powered by AssemblyAI.
- **AI Structured Extraction**: Automated generation of concise summaries, key decisions, action items, and sentiment analysis using Google Gemini.
- **Dynamic Meeting Health Score**: Evaluates engagement, clarity, actionability, and tone to assign a weighted 0–100 quality rating.
- **Multi-Tenant Organizations & Workspace Access**: Workspace switching, organization creation, and invite-code team onboarding backed by Supabase Auth and Row Level Security (RLS).
- **Interactive Kanban Task Board**: Filter, update, and manage action items with real-time velocity metrics across meetings.
- **Export Capabilities**: Clean, professional PDF generation (`pdf-lib`) and editable Microsoft Word (`docx`) document exports.
- **Google Calendar Synchronization**: One-click Google OAuth calendar event creation with direct meeting deep-links.
- **Automated Email Digests**: Per-member email digests with individual task previews delivered via Nodemailer / Gmail SMTP.
- **Multi-Language Support**: Support for English, Hindi, and Gujarati transcription and translation workflows.
- **Dark & Light Mode**: Modern, accessible dark/light themes built with Vanilla CSS variables and Tailwind utilities.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & Motion** | Tailwind CSS, Vanilla CSS Design System, Framer Motion |
| **Backend & Storage** | Supabase (PostgreSQL, Supabase Auth, Storage) |
| **AI & Diarization** | Google Gemini API (`@google/generative-ai`), AssemblyAI API |
| **Integrations** | Google Calendar API (OAuth 2.0), Nodemailer (Gmail SMTP) |
| **Document Generation** | `pdf-lib`, `docx` |
| **Deployment** | Vercel Platform |

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` (v9+) or `yarn` / `pnpm`

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/himatp/Echoes-AI.git
   cd Echoes-AI
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and define the following variables:

   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # AI Service Credentials
   GEMINI_API_KEY=your_gemini_api_key
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key

   # Google Calendar OAuth Credentials
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Email Service (Nodemailer / Gmail SMTP & Resend Fallback)
   GMAIL_USER=your_gmail_address
   GMAIL_APP_PASSWORD=your_gmail_app_password
   RESEND_API_KEY=your_resend_api_key
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
├── public/                # Static assets, branding video/images, favicons
├── src/
│   ├── app/               # Next.js App Router routes & API endpoints
│   │   ├── api/           # Serverless API routes (AI, audio, calendar, email)
│   │   ├── auth/          # Supabase Auth callback handler
│   │   ├── meetings/      # Meeting list & detail views
│   │   ├── new-meeting/   # Audio recording & processing flow
│   │   ├── tasks/         # Kanban board view
│   │   └── team/          # Workspace & team management
│   ├── components/        # UI components, layout headers, modals, cards
│   │   ├── auth/          # Auth modals (Invite, Create Org, AuthProvider)
│   │   ├── layout/        # Navbar & sidebar navigation
│   │   └── ui/            # Reusable UI primitives & LogoLoader
│   ├── context/           # React Theme & Workspace contexts
│   ├── lib/               # Supabase clients, PDF/DOCX generators, AI helpers
│   └── middleware.ts      # Auth protection & session refresh middleware
├── supabase/
│   └── migrations/        # PostgreSQL schemas, RLS policies, tables
└── package.json
```

---

## Demo & Screenshotss

- **Dashboard & Velocity Overview**: `[Dashboard Screenshot]`
- **Meeting Processing & Diarization**: `[Meeting Detail Screenshot]`
- **Kanban Task Board**: `[Task Board Screenshot]`

---

## Known Limitations

- **Row Level Security (RLS)**: Core tables use Supabase Auth for security; extended RLS policies are simplified for demonstration flexibility during evaluation.
- **Google OAuth Consent**: Google Sign-In and Google Calendar consent screens currently reference the default Supabase project domain (`supabase.co`) rather than a custom branded domain.
- **Future Roadmap**: Production features such as automated error tracking (Sentry), API rate-limiting, and subscription billing tier logic are planned for future iterations.
