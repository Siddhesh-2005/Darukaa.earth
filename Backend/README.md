# Daruka FastAPI Backend

FastAPI backend for the Daruka quadrangle workspace.

## Run

From `Demo/Backend`:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@AIVEN_HOST:PORT/DATABASE?sslmode=require"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Set `DATABASE_URL` to the connection string from the Aiven service. Keep it in an environment variable or a local secret manager; do not commit it to the repository.

For Render, add `CORS_ORIGINS` as an environment variable containing the exact Vercel frontend URL, for example `https://your-project.vercel.app`. Separate multiple origins with commas when needed. Vercel preview URLs ending in `.vercel.app` are supported automatically.

The API is available at `http://localhost:8000`. Interactive documentation is at `/docs`.

## Endpoints

- `GET /health`
- `GET /api/quadrangles?district=Mumbai%20Suburban`
- `POST /api/quadrangles`
- `DELETE /api/quadrangles/{id}`

Create payload:

```json
{
  "district": "Mumbai Suburban",
  "coordinates": [[72.8, 19.1], [72.81, 19.1], [72.81, 19.09], [72.8, 19.09]],
  "status": "Draft"
}
```

Quadrangles are persisted in the Aiven PostgreSQL database. The `coordinates` field is stored as PostgreSQL `jsonb` containing the four polygon points in `[longitude, latitude]` order. The table is created automatically when the API starts.
