"""FastAPI main application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
import os
import logging
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from ml_engine import get_model_status
from auth import validate_secret_key

validate_secret_key()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

if os.getenv("AUTO_INIT_DB", "false").lower() == "true":
    init_db()

app = FastAPI(
    title="Mandlakazi GeoProspector AI",
    description="Production-grade geospatial mineral intelligence platform",
    version="1.0.0"
)

environment = os.getenv("ENVIRONMENT", "development").lower()
configured_origins = os.getenv("CORS_ALLOWED_ORIGINS", os.getenv("FRONTEND_URL", ""))
allowed_origins = [origin.strip().rstrip("/") for origin in configured_origins.split(",") if origin.strip()]
if not allowed_origins and environment != "production":
    allowed_origins = ["http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    if request.url.scheme == "https" or environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

from analysis_api import router as analysis_router
from auth import router as auth_router

app.include_router(analysis_router)
app.include_router(auth_router)

# Health check endpoint
@app.get("/health")
async def health():
    model = get_model_status()
    return {
        "status": "healthy" if model["ready"] else "degraded",
        "service": "Mandlakazi GeoProspector API",
        "version": "1.0.0",
        "database_configured": bool(os.getenv("DATABASE_URL")),
        "earth_engine_configured": bool(os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("EARTHENGINE_PROJECT")),
        "report_bucket_configured": bool(os.getenv("REPORT_BUCKET")),
        "model": model,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
