# Lilly Automotive Website

## Overview
Single-page marketing website for Lilly Automotive, an auto repair shop located in Warner Robins, Georgia.

**Live URL:** https://lillyautomotivellc.com

## Tech Stack
- **HTML/CSS/JavaScript** - Single `index.html` file with embedded styles and scripts
- **Fonts:** Google Fonts (Bebas Neue, Outfit)
- **Form backend:** Cloudflare Worker, D1, Workers KV, Turnstile, and Email Service
- **Hosting:** GitHub Pages (indicated by CNAME file)

## Project Structure
```
auto-repair-website/
├── index.html      # Main website (all HTML, CSS, JS)
├── logo.jpg        # Business logo
├── CNAME           # Custom domain config for GitHub Pages
├── worker/         # Cloudflare appointment API, D1 schema, and tests
└── .git/           # Git repository
```

## Key Features
- Fixed navigation with smooth scroll
- Hero section with animated gradient background
- Services grid (6 services: Oil Change, Brakes, Diagnostics, A/C, Transmission, Battery)
- Customer reviews section
- Quick-first callback request form with optional vehicle, date, details, and uploads
- Native date picker with Sunday validation
- Durable Cloudflare request storage and business email notifications
- Private uploads that automatically expire after 30 days
- Scroll-triggered reveal animations
- Fully responsive design

## Design System
- **Primary Color:** Magenta/Pink (#E040E0)
- **Background:** Black/Dark theme
- **Typography:** Bebas Neue (headings), Outfit (body)
- **Style:** Modern, angular clip-paths, subtle grain texture overlay

## Business Information
- **Phone:** (478) 960-2829
- **Address:** 720 S Pleasant Hill Rd, Warner Robins, GA 31088
- **Hours:** Mon-Fri 9AM-5PM, Sat 9AM-12PM, Sun Closed

## Cloudflare Services
- **Worker:** Validates and processes requests at `appointments.lillyautomotivellc.com`
- **D1:** Stores appointment request records
- **Workers KV:** Stores private uploads with a 30-day TTL
- **Turnstile:** Provides client and mandatory server-side spam validation
- **Email Service:** Sends a simple notification to a verified business-owned inbox

Secrets must be stored as Cloudflare Worker secrets and must never be committed.

## Development Notes
- All styles are embedded in `<style>` tags within index.html
- All JavaScript is embedded in `<script>` tags at the end of the body
- No build process required - edit index.html directly
- Test locally through an HTTP server such as `python -m http.server 8000`
- Run Worker unit tests with `npm test` from `worker/`
- Deploy by pushing to GitHub (GitHub Pages serves from main branch)

## External Dependencies (CDN)
- Google Fonts
- Cloudflare Turnstile widget
