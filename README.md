# SolarLog Viewer

Static viewer for SolarLog data exports (HTML/JS/CSS).

## Dev server

```bash
npm install
npm run start
npm run open
```

Starts the dev server at http://localhost:3000 — entry point is `index.html`.  
Run `npm run open` to open the viewer in your default browser.

## Data files

The `min*.js` files (one per day, ~7000+ files) contain the raw solar yield data exported from the SolarLog device. The `days*.js` and `days_hist*.js` files contain aggregated daily/monthly summaries.
