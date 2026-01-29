# Lilly Automotive Website

## Overview
Single-page marketing website for Lilly Automotive, an auto repair shop located in Warner Robins, Georgia.

**Live URL:** https://lillyautomotivellc.com

## Tech Stack
- **HTML/CSS/JavaScript** - Single `index.html` file with embedded styles and scripts
- **Fonts:** Google Fonts (Bebas Neue, Outfit)
- **Date Picker:** Flatpickr
- **Email:** EmailJS for form submissions
- **Hosting:** GitHub Pages (indicated by CNAME file)

## Project Structure
```
auto-repair-website/
├── index.html      # Main website (all HTML, CSS, JS)
├── logo.jpg        # Business logo
├── CNAME           # Custom domain config for GitHub Pages
└── .git/           # Git repository
```

## Key Features
- Fixed navigation with smooth scroll
- Hero section with animated gradient background
- Services grid (6 services: Oil Change, Brakes, Diagnostics, A/C, Transmission, Battery)
- Customer reviews section
- Contact form with appointment scheduling
- Flatpickr date picker (Sundays disabled)
- EmailJS integration for form submissions
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
- **Hours:** Mon-Fri 8AM-5PM, Sat 8AM-12PM, Sun Closed

## Third-Party Services
- **EmailJS:** Credentials are in `index.html` (service ID, template ID, public key)

## Development Notes
- All styles are embedded in `<style>` tags within index.html
- All JavaScript is embedded in `<script>` tags at the end of the body
- No build process required - edit index.html directly
- Test locally by opening index.html in a browser
- Deploy by pushing to GitHub (GitHub Pages serves from main branch)

## External Dependencies (CDN)
- Google Fonts
- Flatpickr CSS & JS
- EmailJS Browser SDK
