import os
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from psycopg import Connection, connect
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


DATABASE_URL = os.getenv("DATABASE_URL")


class QuadrangleInput(BaseModel):
    district: str = Field(min_length=1)
    coordinates: list[tuple[float, float]] = Field(min_length=4, max_length=4)
    status: str = "Draft"


class Quadrangle(QuadrangleInput):
    id: str


app = FastAPI(title="Daruka API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def get_connection() -> Connection:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return connect(DATABASE_URL, row_factory=dict_row)


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS quadrangles (
                id TEXT PRIMARY KEY,
                district TEXT NOT NULL,
                coordinates JSONB NOT NULL,
                status TEXT NOT NULL DEFAULT 'Draft'
            )
            """
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


app.router.lifespan_context = lifespan


@app.get("/")
def read_root():
    return {"message": "Daruka API", "docs": "/docs"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/quadrangles", response_model=list[Quadrangle])
def list_quadrangles(district: str | None = None):
    query = "SELECT id, district, coordinates, status FROM quadrangles"
    parameters: tuple[str, ...] = ()
    if district:
        query += " WHERE district = %s"
        parameters = (district,)
    query += " ORDER BY id"

    with get_connection() as connection:
        return connection.execute(query, parameters).fetchall()


@app.post("/api/quadrangles", response_model=Quadrangle, status_code=201)
def create_quadrangle(payload: QuadrangleInput):
    quadrangle = {
        "id": f"Q-{uuid4().hex[:8].upper()}",
        **payload.model_dump(),
    }

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO quadrangles (id, district, coordinates, status)
            VALUES (%s, %s, %s, %s)
            """,
            (
                quadrangle["id"],
                quadrangle["district"],
                Jsonb(quadrangle["coordinates"]),
                quadrangle["status"],
            ),
        )
    return quadrangle


@app.delete("/api/quadrangles/{quadrangle_id}", status_code=204)
def delete_quadrangle(quadrangle_id: str):
    with get_connection() as connection:
        result = connection.execute(
            "DELETE FROM quadrangles WHERE id = %s",
            (quadrangle_id,),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Quadrangle not found")
    return Response(status_code=204)
