# 🧠 ChalkMind

> **ChalkMind** is an AI-powered educational platform that transforms any topic prompt into a professionally narrated, vector-drawn blackboard animation video using Gemini, Manim, and Supabase.

---

## 🌟 Key Features

* **Prompt-to-Animation Pipeline**: Powered by `gemini-2.5-flash`, breaking down any complex topic (e.g., *AVL Trees*, *Quantum Computing*) into 5–8 structured, sequential narrative scenes with executable Manim Python code.
* **Autonomous Code-Healing Loop**: If a generated Manim script throws a rendering error, the background worker captures the traceback, sends it back to Gemini for automated syntax/layout correction, and retries up to 3 times before failing safely.
* **Normalized Relational Architecture**: Clean database design splitting parent lesson metadata (`lessons`) from granular step-by-step sequence blocks (`scenes`).
* **Cloud-Native Storage & Streaming**: Final compiled `.mp4` videos are uploaded securely to Supabase Storage buckets, featuring public URLs optimized for HTML5 video streaming.
* **Real-Time Progress Tracking**: Non-blocking background worker processes (`render_blackboard.py`) that report incremental progress (35% → 60% → 75% → 90% → 100%) back to Supabase Postgres, driving live UI polling bars.
* **Interactive Dashboard & Viewer**: A dedicated "My Lessons" management hub and an immersive watch page featuring synchronized step-by-step transcripts.

---

## 🏗️ Technical Architecture & Workflow

```
[User Prompt] 
    │
    ▼
[React Router Action] ──(Generates Script via Gemini)──► [Supabase Postgres (lessons & scenes)]
    │
    ├────── Spawns Background Python Worker (`render_blackboard.py`)
    │         │
    │         ├── 1. Synthesizes voiceovers (`edge-tts`) & measures durations (`ffprobe`)
    │         ├── 2. Compiles & renders vector animations (`Manim CE`) [with Gemini Auto-Healing]
    │         ├── 3. Merges audio & video tracks (`FFmpeg`)
    │         └── 4. Uploads final `.mp4` to Supabase Storage & updates DB status (`completed`)
    │
    ▼
[Polling UI / Generate Page] ──(Polls /api/status/:id)──► Redirects to ──► [/watch/:id (Video Player & Transcript)]

```

---

## 🛠️ Tech Stack

* **Frontend / Framework**: React Router / Next.js architecture with Tailwind CSS and shadcn/ui component patterns.
* **Database & Auth & Storage**: Supabase (PostgreSQL, Row Level Security, Auth, Storage Buckets).
* **AI & Machine Learning**: Google GenAI SDK (`gemini-2.5-flash`), Edge TTS (`edge-tts`).
* **Video & Audio Processing**: Manim Community Edition (Python), FFmpeg, FFprobe.
* **Backend Services**: TypeScript server services (`AuthService`, `LessonsService`) and Python background orchestration workers.

---

## 🚀 Getting Started Locally

### Prerequisites

Ensure your local development environment has the following installed:

* **Node.js** (v20+) & **pnpm**
* **Python 3.10+** with `pip`
* **FFmpeg & FFprobe** (`ffmpeg -version`)
* A **Supabase** account and project.

---

### Step 1: Clone & Install Dependencies

Clone the repository and install Node dependencies:

```bash
git clone https://github.com/talha5978/chalkmind.git
cd chalkmind
pnpm install

```

Install the required Python packages for the rendering worker:

```bash
pip install manim edge-tts google-genai

```

---

### Step 2: Configure Environment Variables

Create a `.env` file in the root of your project directory and add your credentials:

```bash
cp .env.example .env
```

---

### Step 3: Supabase CLI Authentication & Migrations

ChalkMind uses the Supabase CLI to manage database schema migrations and TypeScript types.

#### 1. Authenticate with Supabase

Log in to your Supabase account through the CLI:

```bash
pnpm dlx supabase login

```

*(Follow the browser prompt to authorize the Supabase CLI).*

#### 2. Link Your Project

Link your local repository to your remote Supabase project using your project reference ID (found in your Supabase project settings):

```bash
pnpm dlx supabase link --project-ref your-project-ref-id

```

#### 3. Push Database Migrations

Deploy your local database tables (`profiles`, `lessons`, `scenes`) and security policies to Supabase:

```bash
pnpm dlx supabase db push

```

#### 4. Generate TypeScript Types

After your database schema is pushed, auto-generate strict TypeScript definitions for your database tables:

```bash
pnpm gen-types

```

*(Ensure you have `"gen-types": "supabase gen types typescript --local > app/types/supabase.ts"` configured in your `package.json` scripts).*

---

### Step 4: Storage Bucket Setup

1. Navigate to your **Supabase Dashboard** -> **Storage**.
2. Create a new public bucket named **`lessons`**.
3. Apply the necessary storage policies (or run the SQL script below in your Supabase SQL Editor):

```sql
-- 1. Allow authenticated users to upload files to their own folder ({user_id}/{lesson_id}/...)
create policy "Users can upload their own lesson files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lessons' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to update their own lesson files
create policy "Users can update their own lesson files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'lessons' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to delete their own lesson files
create policy "Users can delete their own lesson files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lessons' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow public read access to lesson videos 
-- (Required so the HTML5 <video> tag can stream the .mp4 files using public URLs)
create policy "Public read access for lesson videos"
on storage.objects for select
to public
using (bucket_id = 'lessons');

```

---

### Step 5: Run the Development Server

Start your local development server:

```bash
pnpm dev

```

Open [http://localhost:5173](http://localhost:5173) in your browser to start generating and watching AI blackboard animation lessons!