"""
A3 Television Warranty & Complaint Hub - FastAPI Backend
Main application entry point
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from routers import auth, warranties, complaints, analytics
from database import init_dynamodb
from storage import init_s3, get_storage_info
from models.response import ApiResponse
from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize database and storage on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting up A3TV Warranty Application...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Initialize DynamoDB
    await init_dynamodb()
    logger.info("DynamoDB connection established")
    
    # Initialize S3
    init_s3()
    logger.info("S3 storage initialized")
    
    # Log storage configuration
    storage_info = get_storage_info()
    logger.info(f"Storage configuration: {storage_info}")
    
    yield
    logger.info("Shutting down A3TV Warranty Application...")

# Create FastAPI app
app = FastAPI(
    title="A3 Television Warranty & Complaint Hub API",
    description="Serverless backend for managing warranties and complaints",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware — origins read from CORS_ORIGINS env variable
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(warranties.router, prefix="/api/v1", tags=["warranties"])
app.include_router(complaints.router, prefix="/api/v1", tags=["complaints"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "A3 Television Warranty & Complaint Hub API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs"
    }

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Configuration info endpoint
@app.get("/config")
async def config_info():
    """Get current configuration (storage, database, environment)"""
    return {
        "environment": settings.ENVIRONMENT,
        "database": {
            "type": "DynamoDB",
            "table": settings.DYNAMODB_TABLE_NAME,
            "endpoint": "AWS Managed"
        },
        "storage": get_storage_info(),
        "api_version": "1.0.0"
    }

# Exception handler for HTTP exceptions
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

# Handler for 404s
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "data": None,
            "error": "Endpoint not found",
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

# ── AWS Lambda handler (used by mangum when running on Lambda) ──────────────
# lifespan="off" because Lambda reuses the container; startup ran already.
handler = Mangum(app, lifespan="off")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
