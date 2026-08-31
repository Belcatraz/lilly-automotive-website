# Lilly Automotive Website - Agent Instructions

## Overview

Single-page marketing website for Lilly Automotive auto repair shop. Static HTML/CSS/JS frontend with a Cloudflare Worker appointment API.

## Setup

```bash
# Frontend has no build. Serve it over HTTP for local testing.
python -m http.server 8000

# Worker tests
cd worker
npm test
```

## Development Commands

| Task | Command |
|------|---------|
| View site | Run `python -m http.server 8000` and open localhost |
| Test Worker | Run `npm test` from `worker/` |
| Deploy frontend | Push to `main` branch (GitHub Pages auto-deploys) |
| Deploy API | Deploy `worker/src/index.js` with the bindings in `worker/wrangler.jsonc` |

## Architecture

The frontend is a single `index.html` file containing:
- Embedded CSS in `<style>` tags
- Embedded JavaScript at end of `<body>`
- External CDN dependencies (Google Fonts and Cloudflare Turnstile)

The API in `worker/` uses Cloudflare Worker + D1 + Workers KV + Turnstile + Email Service.

## Key Files

- `index.html` - Main website (all code)
- `logo.jpg` - Business logo
- `CNAME` - Custom domain configuration
- `worker/src/index.js` - Appointment API
- `worker/schema.sql` - D1 schema
- `worker/wrangler.jsonc` - Binding reference (never place secrets here)

## Cloudflare Appointment Service

The form submits `multipart/form-data` to the Worker with:
- `name`, `phone`, `service` - required quick fields
- `vehicle`, `preferred_date`, `details` - optional details
- `media` - up to 3 optional photos/videos
- `cf-turnstile-response` - mandatory spam validation token

The Worker stores the request in D1, uploads in private Workers KV with a 30-day expiry, and sends a plain business notification through Cloudflare Email Service. `TURNSTILE_SECRET` and `MEDIA_LINK_SECRET` must stay in Cloudflare secrets.

## Design System

- **Primary Color:** `#E040E0` (Magenta/Pink)
- **Background:** Black/Dark theme
- **Fonts:** Bebas Neue (headings), Outfit (body)
- **Style:** Angular clip-paths, grain texture overlay

## Testing

1. Serve and open `index.html` through localhost
2. Test responsive design at mobile/tablet/desktop widths
3. Verify form validation (required fields)
4. Verify Sundays are rejected and uploads enforce count/size limits
5. Run `npm test` from `worker/`
6. Never send a real business notification as a test without explicit approval

## Branch Protection (Recommended)

Enable on GitHub: Settings > Branches > Add rule for `main`:
- Require pull request reviews before merging
- Require status checks to pass (if CI added later)

## Common Tasks

### Update business hours
Edit the `.hours-grid` section in `index.html`

### Add a new service
Add a new `.service-card` div in the services grid

### Modify form fields
Update the form HTML, frontend JavaScript, Worker validation, D1 schema if needed, and notification formatting
