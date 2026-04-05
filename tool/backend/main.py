import logging
from src.utils.http_client import http_client
from src.routers import rti_template_router
from fastapi import FastAPI
from contextlib import asynccontextmanager
from src.core.exceptions import BaseAPIException, api_exception_handler
from fastapi_versioning import VersionedFastAPI, version

# Configure logging to show INFO level messages
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lifespan connection starting...")
    await http_client.start()
    yield
    await http_client.close()
    logger.info("Lifespan connection ending...")

app = FastAPI(
    title="RTI Tracker",
    description="A FastAPI backend for RTI tracker",
    version="1.0.0",
    lifespan=lifespan
)

# health check
@app.get("/health", tags=["Service"])
def health_check():
    return {"status": "Healthy Service"}

app.include_router(rti_template_router)
app.add_exception_handler(BaseAPIException, api_exception_handler)


