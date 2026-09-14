# SonicBots — Secure Neural Chat & Realtime Audio Calling

> **Founder & Lead Fullstack Architect:** [Ashfaq](https://sonicbots.vercel.app/founder)  
> **Official Web Platform:** [sonicbots.vercel.app](https://sonicbots.vercel.app)  
> **Founder Biography & Technical Specifications:** [sonicbots.vercel.app/founder](https://sonicbots.vercel.app/founder)  
> **About SonicBots:** [sonicbots.vercel.app/about](https://sonicbots.vercel.app/about)

SonicBots is an advanced real-time communication platform architected and founded by **Ashfaq**. It features end-to-end encrypted WebRTC peer-to-peer audio and video calling, autonomous neural AI chatbot agents (including Titan-Shell AI), biometric security protocols, and multiplayer real-time gaming.

---

## Local development

From the repository root:

```bash
npm install
npm start
```

Then in a second terminal:

```bash
cd client
npm install
npm run dev
```

### Alternative commands

- Run backend only:
  - `cd server && npm install && npm start`
- Run frontend only:
  - `cd client && npm install && npm run dev`

## Production deployment

### Backend

Deploy the `server/` app to a Node host that supports long-running Socket.io servers.

Recommended hosts:

- Railway
- Render
- Fly
- Heroku
- DigitalOcean App Platform
- Any VPS with Node.js

Use this command on the backend host:

```bash
cd server
npm install
npm start
```

Set the host env var if needed:

- `PORT` = 5000 (or the port provided by the host)

### Frontend on Vercel

Deploy only the `client/` folder to Vercel. The root `vercel.json` file in this repo is configured to build the `client` app.

Required environment variable on Vercel:

- `NEXT_PUBLIC_SOCKET_URL` = `https://<your-backend-host>`

Example:

- `https://backend.sonicbots.example`

This is essential because the frontend connects to the backend using Socket.io.

## Important notes

- The frontend cannot run the backend on Vercel reliably.
- The backend must remain live for login, chat, wallet, and Ludo gameplay.
- If you change backend host or domain, update `NEXT_PUBLIC_SOCKET_URL` in Vercel.

## What was added

- `index.js` at repo root to start `server/index.js`
- Root `package.json` scripts: `start` and `backend`
- `client/src/app/page.tsx` now supports `NEXT_PUBLIC_SOCKET_URL`
- `vercel.json` configured for the `client` app
- `DEPLOYMENT.md` with full deployment process
