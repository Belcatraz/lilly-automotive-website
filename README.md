# Lilly Automotive Website

Single-page marketing website for Lilly Automotive, an auto repair shop in Warner Robins, Georgia.

**Live URL:** https://lillyautomotivellc.com

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Belcatraz/lilly-automotive-website.git

# Serve locally (no frontend build required)
python -m http.server 8000
```

## Tech Stack

- HTML/CSS/JavaScript (single file, no build process)
- Google Fonts (Bebas Neue, Outfit)
- Cloudflare Turnstile (spam protection)
- Cloudflare Worker (appointment API and notification formatting)
- Cloudflare D1 (durable request records)
- Cloudflare Workers KV (private uploads with 30-day expiry)
- Cloudflare Email Service (business notifications)
- GitHub Pages (hosting)

## Development

The frontend is a static website with no build process. The appointment API lives in `worker/` and is deployed separately to Cloudflare Workers.

### Testing Locally

1. Run `python -m http.server 8000` and open `http://localhost:8000`
2. Verify the quick fields and optional details disclosure
3. Verify file count/size and Sunday date validation
4. Run `npm test` from `worker/`
5. Do not submit a real production request without approval from the business

### Deployment

- Frontend: push to `main`; GitHub Pages automatically deploys it.
- Worker: deploy `worker/src/index.js` and the bindings described in `worker/wrangler.jsonc`.
- Secrets (`TURNSTILE_SECRET`, `MEDIA_LINK_SECRET`) belong in Cloudflare, never in Git.

## Project Structure

```
├── index.html    # Main website (HTML, CSS, JS embedded)
├── logo.jpg      # Business logo
├── CNAME         # Custom domain for GitHub Pages
├── worker/       # Cloudflare appointment API, schema, and tests
├── AGENTS.md     # AI agent instructions
└── README.md     # This file
```

## Business Information

- **Phone:** (478) 960-2829
- **Address:** 720 S Pleasant Hill Rd, Warner Robins, GA 31088
- **Hours:** Mon-Fri 9AM-5PM, Sat 9AM-12PM, Sun Closed
