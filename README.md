# EDDB Simplemap

## Overview

EDDB Simplemap is an interactive web mapping application built with React + Vite.

It lets you:
- display geographic points from a NocoDB API;
- filter results;
- view details in popups;
- deploy an instance quickly in production.

Main configuration is handled in `src/config.ts`.

## Installation (and update)

### Prerequisites

- Node.js 22 (recommended)
- npm

### First-time installation

```bash
npm install
npm run dev
```

Development app: `http://localhost:5173`

### Update an existing instance

```bash
git pull
npm install
```

Then restart depending on your need:

```bash
# development
npm run dev

# verification build
npm run build
```

## Production deployment

### Option 1 — Direct start (Node)

```bash
npm install
npm run start
```

The `start` script builds the app and then runs `server.mjs` on port `3000`.

### Option 2 — Docker deployment

```bash
docker build -t eddb-simplemap .
docker run -p 3000:3000 eddb-simplemap
```

App: `http://localhost:3000`
