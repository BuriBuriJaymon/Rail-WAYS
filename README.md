# Rail-WAYS Website Prototype v0.1

## What this is
A lightweight, zero-build website prototype based on the Rail-WAYS synopsis.

It uses only:
- HTML
- CSS
- Vanilla JavaScript

No Python, Node.js, PostgreSQL or Docker is required to run this version.

## Run
Open `index.html` directly in a browser.

For GitHub Pages:
1. Create a GitHub repository named `Rail-WAYS`.
2. Upload `index.html`, `css/`, and `js/`.
3. Repository Settings -> Pages.
4. Source: Deploy from a branch.
5. Branch: `main`, folder: `/ (root)`.
6. Save.
7. GitHub will provide the Pages URL.

## Important
The train/station records in `js/data.js` are DEMONSTRATION DATA. They are not live Indian Railways data and must not be presented as such.

When we move to full-stack development, `js/data.js` will be replaced by API calls to the FastAPI backend. The UI can remain largely unchanged.

## Planned evolution
Website prototype -> authorised railway data -> PostgreSQL -> FastAPI -> NetworkX route engine -> constraints -> optimisation -> delay/reliability modelling -> ground transport -> deployment/security hardening.
