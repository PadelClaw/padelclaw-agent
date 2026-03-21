# PadelClaw Design System

Quelle: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`

## 1. Brand

**Name**
PadelClaw

**Tagline**
`Dein KI-Buchungsassistent fuer Padel-Training`

**Farben**
- Primary: `#16a34a` (`bg-[#16a34a]`, Hover `green-700`)
- Background: radial/linear Mix aus `#f7fee7`, `#ffffff`, `#f0fdf4`
- Text: `slate-950`, `slate-900`, `slate-700`, `slate-600`, `slate-500`
- Accent: `green-50`, `green-100`, `green-200`, `green-300`, `green-700`, `green-950`

**Brand-Charakter**
- Frisch, sportlich, hell
- Gruen als klares Padel-/Court-Signal
- Dunkle Demo-Box als Kontrastflaeche fuer Produktmoment

## 2. Typography

**Font-Familie**
- Aktuell keine Custom Font definiert
- `app/layout.tsx` nutzt keine `next/font`-Integration
- Effektiv: Browser/System Sans Serif Default

**Groessen**
- H1: `text-4xl` bis `sm:text-5xl`, `font-black`, `tracking-tight`
- H2: `text-3xl` bis `sm:text-4xl`, `font-bold`, `tracking-tight`
- H3: `text-xl` oder `text-2xl`, `font-semibold` bis `font-bold`
- Body: `text-base` oder `text-lg`, meist `leading-6` bis `leading-8`
- Small: `text-sm`, Badges teils `text-xs`

## 3. Components

**Button Styles**
- Primary:
  `inline-flex items-center justify-center rounded-2xl bg-[#16a34a] px-6 py-3.5 text-base font-semibold text-white transition hover:bg-green-700`
- Secondary:
  `inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-green-300 hover:text-green-700`
- Ghost:
  Aktuell nicht als eigener Stil in `app/page.tsx` vorhanden

**Card Style**
- Outer hero shell:
  `rounded-[2rem] border border-green-100 bg-white/85 ... backdrop-blur`
- Standard content/pricing cards:
  `rounded-[1.75rem] border ... bg-white p-6 shadow-[0_20px_80px_-60px_rgba(15,23,42,0.6)]`
- Featured pricing card:
  `border-green-300 bg-green-50 shadow-[0_30px_120px_-60px_rgba(22,163,74,0.65)]`

**Badge Style**
- Info badge:
  `inline-flex items-center rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700`
- Small badge / featured badge:
  `rounded-full bg-[#16a34a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white`

## 4. Spacing

**Layout**
- Section horizontal padding: `px-4 sm:px-6 lg:px-8`
- Standard vertical rhythm: `py-16`
- Hero top/bottom: `pt-6 pb-16`
- Container width: `mx-auto max-w-6xl`
- Text blocks: `max-w-xl`, `max-w-2xl`, `max-w-md`

**Component Padding**
- Buttons: `px-5/px-6`, `py-3` bis `py-3.5`
- Cards: `p-5` oder `p-6`
- Small info blocks: `px-4 py-3`

**Gaps / Rhythmus**
- CTA groups: `gap-3`
- Major hero split: `gap-12`
- Card grids: `gap-5`
- Copy stacking: haeufig `mt-3`, `mt-4`, `mt-5`, `mt-6`, `mt-8`, `mt-10`

## 5. Tone

- Energiegeladen, direkt, produktnah
- Modern und mobile-first statt korporativ
- Padel-Sport-Feeling durch Gruen, Dynamik, WhatsApp-Live-Demo und klare Action-Copy
- Lean positioning: schnell starten, erst upgraden wenn Umsatz da ist

## 6. AI Slop Check

Diese Dinge wollen wir anhand der aktuellen Landing Page explizit NICHT:

1. Generic SaaS Cards ohne Produktmoment
   Die aktuelle Seite hat eine echte WhatsApp-Demo statt nur austauschbarer B2B-Boxen.

2. Stock-photo-Vibes
   Der Code setzt auf UI, Messaging und Farbe statt generische Team- oder Lifestyle-Bilder.

3. Overly formal / corporate copy
   Die Tonalitaet ist direkt: `Kostenlos starten`, `Starte lean`, `in Minuten live statt Wochen Projektzeit`.
