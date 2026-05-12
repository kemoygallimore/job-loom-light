# RizonHire — User Guide

_Last updated: May 12, 2026_

This guide covers everyday use of RizonHire for three audiences: **Company Users**, **Company Admins**, and **Super Admins**. Candidates do not log in; they apply through public links.

---

## Getting Started

### Signing in
1. Go to your RizonHire URL (e.g. `https://app.rizonhire.com/auth`).
2. Enter the email and password provided by your administrator.
3. If you forgot your password, click **Forgot password** and follow the email link.

> RizonHire is invite-only. New users must be created by a Super Admin (for company admins) or by your company admin.

### The sidebar
- **Dashboard** — KPIs at a glance
- **Jobs** — manage postings
- **Candidates** — search and review applicants
- **Pipeline** — Kanban board of in-flight applications
- **Candidate Tags** — manage tag library (admins)
- **Video Screening** — async video interviews
- **Assessment** — reserved for future workflows

The sidebar can be collapsed via the chevron at the top.

---

## For Company Users

### Posting a job
1. Open **Jobs** → **New job**.
2. Enter title, hiring manager, and description (rich text supported).
3. Set status to **Open** to make it visible on your public careers page.
4. Each company has a maximum number of open jobs; close older roles if you hit the limit.

Your public careers page is `https://app.rizonhire.com/<your-company-slug>/careers`. Share this with candidates.

### Reviewing candidates
1. Open **Candidates**.
2. Use the search bar and filters (job, education level, **parish/state**, tags) to narrow the list.
3. Click a candidate to open their profile:
   - **Contact** — email, phone, LinkedIn, address
   - **Resume history** — download any version
   - **Activity timeline** — applications and stage changes
   - **Notes** — your private notes (visible to your company)
   - **Interview feedback** — internal and guest entries
   - **Tags** — apply / remove labels

> New candidates can only enter the system through your public application links. There is no manual "Add candidate" button.

### Moving candidates through the pipeline
1. Open **Pipeline**.
2. Drag a candidate card from one stage to the next (Applied → Screening → Interview → Offer → Hired/Rejected).
3. Click any card to open the side panel for quick review.

### Sharing a job link
On a job detail page, copy the URL:
- Public detail: `/{company-slug}/careers/{job-id}`
- Direct apply: `/apply/{job-id}`

### Collecting external feedback
1. Open the candidate profile → **Interview feedback** → **Generate guest link**.
2. Send the link to the interviewer. It expires in 30 days.
3. Submitted feedback appears in the candidate's profile automatically.

### Video screening
1. Open **Video Screening** → **New screening**.
2. Pick a job, write the question, set the expiry date.
3. Share the unique link with the candidate.
4. Review submissions under **Video Screening** → click the job → **Submissions**.
5. Rate, leave notes, change status.

---

## For Company Admins

Admins can do everything Users can, plus:

### Manage candidate tags
1. Go to **Candidate Tags**.
2. Create labels with colors. Apply them from candidate profiles or pipeline cards.

### Delete records
- Admins can delete jobs, candidates, candidate files, applications, screening submissions, and feedback for their company.
- Deletes are permanent.

### Open-job limits
The limit is set by your Super Admin. If you've reached it, close an existing job before opening a new one.

---

## For Super Admins

Super Admins manage the platform across tenants.

### Overview
The **Overview** screen shows aggregate counts of companies, users, and jobs across all tenants.

### Companies
1. Go to **Admin → Companies**.
2. **New Company**:
   - Enter the company name. The system generates a unique slug for the public careers page.
   - Provide the initial admin's name, email, and a temporary password.
   - The system creates the auth user, profile, and `admin` role assignment automatically.
3. **Edit open-job limit**: click the limit value in the Open / Limit column, type a new number, click ✓.
4. **Search**: filter the list by company name.

> Companies cannot be deleted from the UI by design — contact platform support for tenant removal.

---

## For Candidates (Public Pages)

### Browsing roles
- Go to a company's careers page: `https://app.rizonhire.com/<company-slug>/careers`.
- Click any open role to view its full description.

### Applying
1. Click **Apply now**.
2. Fill in the form:
   - Name, email, phone (required)
   - Address, parish/state, country
   - Education level
   - LinkedIn profile URL (optional, must start with `https://www.linkedin.com/`)
   - Upload your resume (PDF/DOC/DOCX)
3. Read and check the **Data Protection Agreement** (link opens in a new tab).
4. Submit. You will see a confirmation screen.

### Video screening
If invited via a unique link:
1. Open the link.
2. Accept the privacy notice.
3. Read the question, then record your one-take answer within the timer.
4. Wait for the upload to complete before closing the tab.

### Guest feedback
Interviewers receive a one-time link valid for 30 days:
1. Open the link.
2. Provide a star rating and written feedback (strengths, weaknesses, opportunities).
3. Submit.

---

## Privacy & Data Protection

All candidate data is protected under the policy at `/legal/data-protection`. Resumes and screening videos are stored in private storage; access is only granted via short-lived signed links.

---

## Troubleshooting

| Problem | Try this |
|---|---|
| Can't sign in | Use **Forgot password**. If invite never arrived, contact your admin. |
| Public careers page shows "company not found" | The company has no open jobs, or the slug is wrong. |
| Resume upload fails | Check file size (≤ 10 MB) and type (PDF/DOC/DOCX). Try a different browser. |
| LinkedIn URL rejected | Must start with `https://www.linkedin.com/` and be under 500 chars. |
| Pipeline drag does nothing | Refresh the page; another user may have moved the candidate. |
| Hit open-job limit | Close an old job, or ask your Super Admin to raise the limit. |
