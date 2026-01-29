# Lilly Automotive Website - Agent Instructions

## Overview

Single-page marketing website for Lilly Automotive auto repair shop. Static HTML/CSS/JS with no build process.

## Setup

```bash
# No dependencies to install - just open index.html in a browser
```

## Development Commands

| Task | Command |
|------|---------|
| View site | Open `index.html` in browser |
| Deploy | Push to `main` branch (GitHub Pages auto-deploys) |

## Architecture

Single `index.html` file containing:
- Embedded CSS in `<style>` tags
- Embedded JavaScript at end of `<body>`
- External CDN dependencies (Google Fonts, Flatpickr, EmailJS)

## Key Files

- `index.html` - Main website (all code)
- `logo.jpg` - Business logo
- `CNAME` - Custom domain configuration

## Third-Party Services

### EmailJS (Contact Form)
Credentials are in `index.html`. Template expects these parameters:
- `name` - Customer name
- `phone` - Phone number
- `vehicle` - Year, Make, Model
- `date` - Preferred appointment date
- `service` - Service type
- `message` - Additional details
- `vehicle_id` - License plate or VIN (optional)

## Design System

- **Primary Color:** `#E040E0` (Magenta/Pink)
- **Background:** Black/Dark theme
- **Fonts:** Bebas Neue (headings), Outfit (body)
- **Style:** Angular clip-paths, grain texture overlay

## Testing

1. Open `index.html` in browser
2. Test responsive design at mobile/tablet/desktop widths
3. Verify form validation (required fields)
4. Test date picker (Sundays should be disabled)
5. Form submission requires valid EmailJS configuration

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
Update both the HTML form and the `templateParams` object in the JavaScript
