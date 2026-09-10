from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import JobStatus
from app.scheduler import JOB_REGISTRY, _safe_run
import asyncio

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/status")
def job_status(db: Session = Depends(get_db)):
    rows = db.query(JobStatus).all()
    return [
        {
            "job_name": r.job_name,
            "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
            "last_success_at": r.last_success_at.isoformat() if r.last_success_at else None,
            "last_error": r.last_error,
            "run_count": r.run_count,
            "healthy": r.last_error is None,
        }
        for r in rows
    ]


@router.post("/trigger/{job_name}")
async def trigger_job(job_name: str):
    """Runs a job immediately instead of waiting for its scheduled interval."""
    if job_name not in JOB_REGISTRY:
        raise HTTPException(404, f"unknown job: {job_name}. Known jobs: {list(JOB_REGISTRY.keys())}")
    asyncio.create_task(_safe_run(job_name, JOB_REGISTRY[job_name]))
    return {"triggered": job_name}
