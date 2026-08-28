# OvertakeJS

A race simulation engine that calculates race outcomes using real car performance data and visualizes the results as a sped-up, real-time race.

Pick your cars, pick a track, and let the simulation crunch the numbers (horsepower, weight, grip, and more) to determine who wins, the lap times, and the gaps. Then watch it play out live.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, HTML5 Canvas |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |

## Project Structure

​```
OvertakeJS/
├── frontend/           # React app (Vite dev server on :5173)
│   └── src/
├── backend/            # Express API (on :5000)
│   ├── config/         # Supabase client config
│   ├── controllers/    # Route handlers
│   └── routes/         # API route definitions
└── README.md
​```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A free [Supabase](https://supabase.com/) project

### Installation

Clone the repository:

​```bash
git clone https://github.com/YOUR_USERNAME/OvertakeJS.git
cd OvertakeJS
​```

Install frontend dependencies:

​```bash
cd frontend
npm install
​```

Install backend dependencies:

​```bash
cd ../backend
npm install
​```

### Configuration

In the `backend` folder, create a `.env` file from the example:

​```bash
cp .env.example .env
​```

Then add your Supabase credentials:

​```
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
​```

### Running the App

You will need two terminal windows, one for each server.

**Terminal 1, Backend:**

​```bash
cd backend
npm run dev
​```

**Terminal 2, Frontend:**

​```bash
cd frontend
npm run dev
​```

The app will be available at `http://localhost:5173`, and the API at `http://localhost:5000`.

## Roadmap

- [x] Project scaffolding
- [ ] Database schema (cars, tracks, races)
- [ ] Simulation engine
- [ ] REST API endpoints
- [ ] Race setup UI
- [ ] Live Canvas race visualization
- [ ] Race history and leaderboards

## License

All rights reserved.
