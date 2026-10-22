# OvertakeJS

A race simulation engine that calculates race outcomes using real car performance data and visualizes the results as a sped-up, real-time race.

Pick your cars, pick a track, and let the simulation crunch the numbers (horsepower, weight, grip, and more) to determine who wins, the lap times, and the gaps. Then watch it play out live.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, HTML5 Canvas, Motion |
| Backend | Node.js, Express |
| Database | MongoDB |

## Running locally

Needs Node 20+ and MongoDB 7 on `127.0.0.1:27017` (without MongoDB the API falls back to in-memory data that resets on restart).

```bash
cp backend/.env.example backend/.env   # then set JWT_SECRET (see the comment in the file)
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix backend           # API on http://localhost:5000
npm run dev --prefix frontend          # app on http://localhost:5173
```

## Features

- [x] Physics engine: quasi-steady-state lap solver and a time-domain race sim with slipstream, dirty air and overtaking
- [x] Race setup UI and live Canvas race view with onboard camera and telemetry
- [x] MongoDB persistence for cars, tracks and races
- [x] Accounts: email and password or Google sign-in, revocable cookie sessions
- [x] Trading card packs and a collection
- [x] Garage: custom builds from car and part cards, raceable in the sim
- [x] Online multiplayer: rooms of up to 8 drivers race their builds, watched live and in sync
- [ ] Race history and leaderboards

## Multiplayer

Players open or join a room at `/multiplayer` (public rooms are listed; private ones join by code or invite link), each pick one of their garage builds or a stock car, and ready up. The host sets the circuit and laps and starts the race.

The server is authoritative: clients only send ids, every car is rebuilt from its owner's garage at the start, the race is simulated on the server, and all players receive the same result with a shared start time so they watch it live together at 4x speed.

- Transport: WebSockets at `/api/multiplayer` on the API port (`backend/multiplayer/socket.js`), authenticated with the session cookie and limited to the `CLIENT_URL` origin.
- Room logic: `backend/multiplayer/rooms.js`, tested by `npm test` in `backend/`.
- Rooms live in memory, so the API must run as a single process.

## License

All rights reserved.
