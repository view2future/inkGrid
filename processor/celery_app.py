"""
Celery Task Queue for InkGrid Processor.

Handles asynchronous processing of stele images using VLM (KIMI API).
"""

from celery import Celery
import os
import sys

# Ensure processor root is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.inference import run_vlm_analysis, run_vlm_region_analysis, batch_analyze_steles

# Redis configuration
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "inkgrid_processor",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
    worker_prefetch_multiplier=1,  # Process one task at a time per worker
)


@celery_app.task(name="tasks.process_stele", bind=True)
def process_stele(self, image_path: str, stele_name: str, script_type: str = "篆书", provider: str = "gemini"):
    """
    Process a single stele image using VLM.
    
    Args:
        image_path: Path to the stele image
        stele_name: Name of the stele
        script_type: Script type (篆书, 隶书, etc.)
        provider: VLM provider (gemini or kimi)
        
    Returns:
        Dictionary with status and analysis results
    """
    self.update_state(state='PROGRESS', meta={'progress': 10, 'status': 'Initializing'})
    
    try:
        self.update_state(state='PROGRESS', meta={'progress': 30, 'status': f'Sending to {provider.upper()} VLM'})
        
        result = run_vlm_analysis(
            image_path=image_path,
            stele_name=stele_name,
            script_type=script_type,
            use_ground_truth=True,
            provider=provider
        )
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'status': 'Finalizing'})
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        import traceback
        return {
            "status": "failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@celery_app.task(name="tasks.process_region", bind=True)
def process_region(self, image_path: str, region_bbox: list, stele_name: str = "Unknown", script_type: str = "Unknown", provider: str = "gemini"):
    """
    Process a specific region of a stele image.
    """
    try:
        result = run_vlm_region_analysis(
            image_path=image_path,
            region_bbox=region_bbox,
            stele_name=stele_name,
            script_type=script_type,
            provider=provider
        )
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        import traceback
        return {
            "status": "failed",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@celery_app.task(name="tasks.process_batch", bind=True)
def process_batch(self, batch_data: list, provider: str = "gemini"):
    """
    Process multiple stele images in batch.
    """
    total = len(batch_data)
    results = []
    
    for i, item in enumerate(batch_data):
        progress = int((i / total) * 100)
        self.update_state(
            state='PROGRESS', 
            meta={'progress': progress, 'status': f'Processing {i+1}/{total}: {item["stele_name"]} ({provider})'}
        )
        
        try:
            result = run_vlm_analysis(
                image_path=item['image_path'],
                stele_name=item['stele_name'],
                script_type=item.get('script_type', '篆书'),
                use_ground_truth=True,
                provider=provider
            )
            results.append({
                "status": "success",
                "stele_name": item['stele_name'],
                "data": result
            })
        except Exception as e:
            results.append({
                "status": "failed",
                "stele_name": item['stele_name'],
                "error": str(e)
            })
    
    return {
        "status": "completed",
        "total": total,
        "successful": sum(1 for r in results if r['status'] == 'success'),
        "failed": sum(1 for r in results if r['status'] == 'failed'),
        "results": results
    }


if __name__ == "__main__":
    celery_app.start()
