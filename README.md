# Azzurro Hotels Recruitment App — GitHub + Supabase

## What is working
- Responsive job posting for desktop, tablet and mobile
- Eligibility gate: Australian work rights + TFN
- Applicant details, mobile and WhatsApp
- Resume upload to private Supabase Storage
- Five one-way video interview questions
- Camera/microphone recording on modern mobile and desktop browsers
- No retakes after a successful answer upload
- Cross-browser MediaRecorder format selection (MP4 where supported, WebM otherwise)
- Application completion only after all 5 interview responses are saved
- Secure Supabase Auth admin login
- Live admin applicant list
- Applicant review modal with contact details, resume, all video responses, status and internal notes
- Private signed URLs for resumes/videos
- Mobile-responsive admin dashboard

## Required Supabase setup
1. Open Supabase → SQL Editor.
2. Run `supabase-setup.sql`.
3. Open Authentication → Users → Add user.
4. Create:
   - Email: `admin001@azzurro.local`
   - Password: the admin password chosen for this project
   - Auto-confirm: ON

The visible admin username remains `Admin001`.

## GitHub Pages
Upload these files to the repository root:
- index.html
- styles.css
- app.js
- config.js
- admin-login.html
- admin.html

Enable GitHub Pages for the repository.

## Security
- The Supabase anon key in `config.js` is expected to be public.
- Row Level Security protects applicant records.
- Resume and video buckets are private.
- Admin files are delivered via short-lived signed URLs.
- The admin password is not stored in GitHub.
- Never add a Supabase service-role key to frontend files.

## Browser note
Camera/microphone access requires HTTPS. GitHub Pages serves over HTTPS, so this is supported. Users must grant camera and microphone permission.
