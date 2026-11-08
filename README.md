<p align="center">
  <a href="https://tarde-esportiva.vercel.app">
    <img src="https://tarde-esportiva.vercel.app/opengraph-image" alt="Tarde Esportiva Banner" width="100%" />
  </a>
</p>

<h1 align="center">Tarde Esportiva</h1>

<p align="center">
  <strong>A modern, state-of-the-art match management and post-match player rating platform for football communities.</strong>
</p>

<p align="center">
  <a href="https://tarde-esportiva.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-tarde--esportiva.vercel.app-16281e?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js_16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-the-rating-algorithm">Rating Algorithm</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-deployment">Deployment</a> •
  <a href="#-license">License</a>
</p>

---

## 🌟 Overview

**Tarde Esportiva** elevates amateur pick-up football (*peladas*) into a competitive, professional tournament experience.

Managing weekend matches is often chaotic: rosters pasted into messaging apps, unbalanced teams, subjective arguments over match performance, and lost match histories. **Tarde Esportiva** solves this with an end-to-end workflow:
1. **Roster & Attendance:** Instant WhatsApp roster parsing, team color allocation, and goalkeeper assignment.
2. **Post-Match Voting:** Token-based peer ballots with structured sections (teammates, opponents, and goalkeepers).
3. **Robust Score Engine:** A statistical rating algorithm that discounts trolls, attenuates low-variance voters, and dynamically scales performance amplitude.
4. **Historical Profiles & Medals:** Cumulative player rankings, podium medals, and detailed performance cards.

---

## ✨ Key Features

### 📋 Attendance & Team Management
- **Smart Roster Import:** Paste raw numbered lists from WhatsApp; the parser automatically strips numbers, handles nicknames, and applies Portuguese Title Case.
- **4-Team Color System:** Soft palettes for **Blue** (`#2c4a6e`), **Red** (`#9e2a2b`), **Black** (`#1f1f1f`), and pure **Yellow** (`#d9a520`) with dedicated team sorting.
- **Goalkeeper & Position Tagging:** Toggle goalkeeper gloves on/off with distinct UI indicators for fair distribution.

### 🗳️ Streamlined Voting Ballot
- **Token-Based Match Access:** Secure voting links without requiring player account creation.
- **Structured Ballot Layout:**
  1. **Teammates:** Directly visible for quick evaluation.
  2. **Other Players:** Collapsible dropdown for optional cross-team scoring.
  3. **Goalkeepers:** Dedicated table positioned right before confirmation.
- **WhatsApp Link Preview:** Native OpenGraph dynamic banner integration (`1200x630`) with rich previews on social unfurls.

### 🛡️ Admin & Live Governance
- **PIN & Role Access:** Password-protected organizer dashboard.
- **Live Ballot Auditing:** Real-time visibility into all submitted ballots, ability to inspect individual ratings, edit grades, or reset a voter's ballot.
- **Match Lifecycle:** Open and close voting windows at will with persistent database locking.

### 🎨 Retro-Editorial Design System
- **Classic Stadium Aesthetic:** Warm paper background (`#F6F4EF`), dark moss green (`#16281E`), and gold accents (`#D9A520`).
- **Responsive Layout:** Optimized for mobile phones on the pitch and widescreen desktop browser viewports.

---

## 📐 The Rating Algorithm

Unlike simple arithmetic means that are easily skewed by lazy voters or outlier scores, **Tarde Esportiva** implements a multi-stage robust rating engine (`src/lib/rating.ts`):

```mermaid
flowchart LR
    A["Raw Votes (1.0 - 5.0)"] --> B["Voter Variance Analysis"]
    B --> C["Outlier Attenuation (Min/Max Trim)"]
    C --> D["Proportional Amplitude Stretch"]
    D --> E["Match Final Grade"]
    E --> F["Bayesian History Aggregation"]
```

### 1. Voter Variance Weighting
Voters who assign the exact same score to all players provide low informational value. The system computes the sample variance $\sigma_v^2$ for each voter $v$:

$$\text{weight}_v = \min\left(1.0,\, 0.2 + 0.8 \cdot \frac{\sigma_v^2}{\sigma_{\text{threshold}}^2}\right)$$

### 2. Outlier Trimming
Extreme high or low outlier votes are softened using modified trimmed weights so a single malicious grade cannot ruin a player's average.

### 3. Amplitude Stretching
When a match has high differentiation and voter consensus, the engine proportionately stretches top-tier and bottom-tier performances into distinct brackets (e.g. `4.6` – `5.0` for standout players), preventing score compression around `3.0`.

### 4. Bayesian Historical Weighting
Player career ratings update using dynamic match weights capped at 10 games, ensuring historical consistency while reflecting current form:

$$\text{Rating}_{\text{new}} = \frac{\text{Rating}_{\text{old}} \cdot W_{\text{prev}} + \text{Score}_{\text{match}}}{W_{\text{prev}} + 1}$$

---

## 🛠️ Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **[Next.js 16](https://nextjs.org)** | React framework with Turbopack, App Router, Server Components & Server Actions |
| **[React 19](https://react.dev)** | Core UI library utilizing concurrent features (`useTransition`, `Suspense`) |
| **[TypeScript 5](https://www.typescriptlang.org)** | Strict end-to-end type safety |
| **[Tailwind CSS v4](https://tailwindcss.com)** | Modern utility-first CSS styling engine |
| **[Prisma ORM 7](https://www.prisma.io)** | Type-safe database queries and schema management |
| **[PostgreSQL](https://www.postgresql.org)** | Relational database (compatible with Neon, Supabase, Vercel Postgres) |
| **[Lucide Icons](https://lucide.dev)** | Crisp iconography |
| **[@vercel/og](https://vercel.com/docs/functions/og-image-generation)** | Dynamic Open Graph banner rendering via Satori & SVG |

---

## 📁 Project Structure

```text
tarde-esportiva/
├── prisma/
│   └── schema.prisma         # Database models (Match, Player, Attendance, Vote)
├── public/
│   └── assets/               # Static images and Open Graph banners
├── src/
│   ├── app/
│   │   ├── actions.ts        # Server Actions (voting, attendance, admin mutations)
│   │   ├── admin/            # Organizer dashboard, match setup & vote auditor
│   │   ├── historico/        # Match history and completed games list
│   │   ├── perfil/[id]/      # Detailed player career profiles and stat cards
│   │   ├── votar/            # Post-match peer voting ballot
│   │   ├── layout.tsx        # Root shell, header banner & OpenGraph metadata
│   │   ├── page.tsx          # Match day hub & current live standings
│   │   └── opengraph-image.tsx # Dynamic SVG social preview banner
│   ├── components/           # Reusable UI cards, badges, and forms
│   │   ├── vote-form.tsx     # Balloting system (Teammates -> Others -> Goalkeepers)
│   │   ├── ui.tsx            # Team color badges, glove badges, loading skeletons
│   │   └── ...
│   └── lib/
│       ├── db.ts             # Prisma client singleton with PG adapter
│       ├── rating.ts         # Statistical rating math, variance & medal ties
│       ├── parse-roster.ts   # WhatsApp list parser
│       └── format.ts         # Brazilian date & number formatting
└── tests/
    ├── unit.test.ts          # Core rating, math, layout & parser test suite
    └── edge-cases.test.ts    # Boundary conditions, ties, and variance edge cases
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or later
- **npm** or **pnpm**
- **PostgreSQL Database**: Local or managed (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com))

### 1. Clone & Install
```bash
git clone https://github.com/danielpasquini/tarde-esportiva.git
cd tarde-esportiva
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:password@localhost:5432/tarde_esportiva"

# Organizer password for the admin panel
ADMIN_PASSWORD="your-secure-admin-password"

# Public application URL for OpenGraph resolution
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Initialize the Database
Generate the Prisma Client and sync the schema with your database:

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Tests

The test suite contains 31+ unit and edge-case tests validating rating mathematics, medal tie-breaking, roster parsing, layout rules, and OpenGraph configuration:

```bash
npm test
```

To run a TypeScript typecheck without emitting code:
```bash
npx tsc --noEmit
```

---

## 🚢 Deployment

### Deploy to Vercel

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. Set the Environment Variables:
   - `DATABASE_URL`: Your production PostgreSQL connection string.
   - `ADMIN_PASSWORD`: Your organizer secret password.
   - `NEXT_PUBLIC_APP_URL`: `https://your-domain.vercel.app`
4. Deploy! Next.js will build with Turbopack and automatically configure edge OpenGraph image generation.

> **Note:** The build script is configured with `prisma generate && prisma db push && next build`, ensuring your database schema is updated automatically on deployment without wiping user data.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
