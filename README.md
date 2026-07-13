# 🛡️ ScamShield — Fake Internship & Job Scam Detection Platform

ScamShield is a student-focused cybersecurity web app that helps detect fake internships, fraudulent job offers, and scam recruitment messages. Built with **TanStack Start**, **React 19**, and **Supabase**.

---

## ✨ Features

| Module                           | Description                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **URL Threat Scanner**           | Paste a suspicious link — analyzes domain age, TLD, typosquatting, brand impersonation, and scam-keyword patterns. Animated risk gauge shows a 0–100 threat score. |
| **Offer Message Analyzer**       | Paste a WhatsApp/Telegram/email recruiter message — inline-highlights scam phrases (upfront fees, crypto payouts, pressure tactics) with per-phrase explanations.  |
| **AI PDF Offer Letter Analyzer** | Upload an appointment letter or training agreement — scans extracted text for hidden financial traps and fraudulent clauses.                                       |
| **Crowdsourced Fraud Feed**      | Browse and submit student-reported scam companies. Authenticated with Supabase RLS.                                                                                |
| **AI Assistant Chatbot**         | Floating AI assistant that detects threats in real-time and provides actionable safety advice. Powered by server-side AI gateway.                                  |
| **Unified Scan History**         | All scans across modules are tracked locally with a slide-out drawer for review.                                                                                   |

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19, SSR)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + custom cyberpunk design system
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- **Backend**: [Supabase](https://supabase.com/) (Postgres, Auth, RLS)

- **AI**: Server-side chat via Lovable AI Gateway
- **Package Manager**: npm

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [Supabase](https://supabase.com) project

### 1. Clone the Repository

```bash
git clone https://github.com/reshmaprattipati21/shield-student-scan.git
cd shield-student-scan
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

| Variable                        | Required | Description                                      |
| ------------------------------- | -------- | ------------------------------------------------ |
| `SUPABASE_PROJECT_ID`           | ✅       | Your Supabase project ID                         |
| `SUPABASE_URL`                  | ✅       | `https://<project-id>.supabase.co`               |
| `SUPABASE_PUBLISHABLE_KEY`      | ✅       | Supabase anon/public key                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅       | Supabase service role key (server-side only)     |
| `VITE_SUPABASE_PROJECT_ID`      | ✅       | Same as `SUPABASE_PROJECT_ID` (client-side)      |
| `VITE_SUPABASE_URL`             | ✅       | Same as `SUPABASE_URL` (client-side)             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅       | Same as `SUPABASE_PUBLISHABLE_KEY` (client-side) |
| `AI_API_KEY`                    | ❌       | AI gateway key (for AI chatbot)                  |

### 4. Run Database Migrations

Apply the SQL migrations in `supabase/migrations/` to your Supabase project via the Supabase Dashboard SQL editor or the Supabase CLI.

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 📁 Project Structure

```
src/
├── components/          # Shared React components
│   ├── ui/              # shadcn/ui primitives (46 components)
│   ├── AIAssistant.tsx   # Floating AI chatbot
│   ├── Navbar.tsx        # Top navigation bar
│   ├── RiskGauge.tsx     # Animated SVG risk gauge
│   └── ...
├── hooks/               # Custom React hooks
├── integrations/
│   ├── supabase/        # Supabase client, types, auth middleware
│   └── lovable/         # Lovable OAuth integration
├── lib/
│   ├── scan-engine.ts   # Core scam detection engine (URL + text)
│   ├── scan-history.ts  # localStorage-based scan history
│   ├── auth-context.tsx  # Auth provider (local + Supabase)
│   └── chat.functions.ts # Server-side AI chat function
├── routes/
│   ├── __root.tsx       # Root layout (providers, error boundaries)
│   ├── index.tsx        # Dashboard / landing page
│   ├── auth.tsx         # Sign in / sign up
│   ├── url-checker.tsx  # URL threat scanner
│   ├── text-scanner.tsx # Message analyzer
│   ├── pdf-analyzer.tsx # PDF offer letter analyzer
│   └── reports.tsx      # Crowdsourced fraud feed
├── server.ts            # SSR entry
├── start.ts             # TanStack Start config + middleware
├── router.tsx           # Router factory
└── styles.css           # Global Tailwind + cyberpunk theme
```

---

## 🏗️ Building for Production

```bash
npm run build
```


---

## 🔐 Security Notes

- **Never commit `.env` files** — the `.gitignore` is configured to exclude them.
- **Supabase RLS** is enabled on all tables. Only authenticated users can read/write reports.
- **Server functions** are used for AI chat to keep API keys server-side only.
- **Input validation** is enforced via Zod schemas on server functions.

---

## 📄 License

This project is private. All rights reserved.
