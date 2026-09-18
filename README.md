# Darukaa.Earth

Darukaa.Earth is a geospatial web application for creating, viewing, and managing urban quadrangles on an interactive Mapbox map.

Users can select a district, view existing quadrangles, draw a new four-point polygon, save its coordinates to PostgreSQL, and delete existing quadrangles.

##Live Application

https://darukaa-earth-nine.vercel.app/

## Architecture

<img width="717" height="609" alt="image" src="https://github.com/user-attachments/assets/28ee0e02-a7ee-4629-8119-9074765d17d9" />


## Tech Stack

* Frontend: React, Vite, JavaScript, Mapbox GL JS
* Backend: Python, FastAPI, Uvicorn, Psycopg 3, Pydantic
* Database: Aiven PostgreSQL
* Deployment: Vercel + Render + Aiven

## Project Structure

```text
Demo/
├── Backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── README.md
│   └── data/
│
├── Frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── services/
│   │       └── quadrangleService.js
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## Features

* District-based quadrangle filtering
* Interactive Mapbox visualization
* Four-point polygon drawing
* Coordinate preview
* PostgreSQL persistence
* Create and delete quadrangles
* FastAPI Swagger documentation
* CORS support for local and production environments

## Coordinate Format

Coordinates follow the GeoJSON convention:

```text
[longitude, latitude]
```

A quadrangle contains exactly four points:

```json
[
  [72.8000, 19.1000],
  [72.8100, 19.1000],
  [72.8100, 19.0900],
  [72.8000, 19.0900]
]
```

The polygon is closed when rendered on the map; the closing point does not need to be stored separately.

## Local Setup

### 1. Backend

```bash
cd Demo/Backend
python -m venv .venv
```

Git Bash:

```bash
source .venv/Scripts/activate
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Set the database URL.

Git Bash:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require'
```

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

Start the server:

```bash
python -m uvicorn main:app --reload --port 8000
```

If `uvicorn` is unavailable:

```bash
./.venv/Scripts/python.exe -m uvicorn main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 2. Frontend

Open another terminal:

```bash
cd Demo/Frontend
npm install
```

Create `Frontend/.env`:

```env
VITE_MAPBOX_TOKEN=your_mapbox_public_token
VITE_API_BASE_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Frontend Commands

```bash
npm run dev       # Development server
npm run lint      # ESLint
npm run build     # Production build
npm run preview   # Preview production build
```

## API

| Method | Endpoint                           | Description          |
| ------ | ---------------------------------- | -------------------- |
| GET    | `/health`                          | Backend health check |
| GET    | `/api/quadrangles`                 | Get all quadrangles  |
| GET    | `/api/quadrangles?district=<name>` | Filter by district   |
| POST   | `/api/quadrangles`                 | Create quadrangle    |
| DELETE | `/api/quadrangles/{id}`            | Delete quadrangle    |

### Create Example

```http
POST /api/quadrangles
Content-Type: application/json
```

```json
{
  "district": "Mumbai Suburban",
  "coordinates": [
    [72.8000, 19.1000],
    [72.8100, 19.1000],
    [72.8100, 19.0900],
    [72.8000, 19.0900]
  ],
  "status": "Draft"
}
```

### Example Response

```json
{
  "id": "Q-1042",
  "district": "Mumbai Suburban",
  "status": "Draft",
  "coordinates": [
    [72.8000, 19.1000],
    [72.8100, 19.1000],
    [72.8100, 19.0900],
    [72.8000, 19.0900]
  ]
}
```

## Database

The application uses PostgreSQL with a `quadrangles` table:

```sql
CREATE TABLE quadrangles (
    id TEXT PRIMARY KEY,
    district TEXT NOT NULL,
    coordinates JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft'
);
```

Coordinates are stored as `jsonb` to preserve the four-point coordinate structure.

The database connection is provided through:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

## Deployment

### Aiven

Create a PostgreSQL service in Aiven and obtain its connection string.

Use that value as `DATABASE_URL` in Render.

### Render — Backend

Create a Render Web Service connected to the repository.

| Setting        | Value                                          |
| -------------- | ---------------------------------------------- |
| Root Directory | `Backend`                                      |
| Build Command  | `pip install -r requirements.txt`              |
| Start Command  | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

Environment variables:

```text
DATABASE_URL=your_aiven_connection_string
CORS_ORIGINS=https://your-project.vercel.app
```

After deployment, test:

```text
https://your-service.onrender.com/health
https://your-service.onrender.com/docs
```

### Vercel — Frontend

Create a Vercel project connected to the repository.

| Setting        | Value      |
| -------------- | ---------- |
| Root Directory | `Frontend` |
| Framework      | Vite       |

Environment variables:

```text
VITE_API_BASE_URL=https://your-service.onrender.com
VITE_MAPBOX_TOKEN=your_mapbox_public_token
```

Redeploy after changing `VITE_*` variables because they are embedded during the Vite build.




## License

This project is intended for Darukaa.Earth application and development use.
