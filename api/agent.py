"""Private Python function in the same Vercel deployment as the Node API."""
import os
import sys
import secrets
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'hiring-agent'))

from fastapi import Request
from fastapi.responses import JSONResponse
from backend.main import app


@app.middleware('http')
async def authenticate_agent(request: Request, call_next):
    expected = os.environ.get('AGENT_INTERNAL_SECRET', '')
    provided = request.headers.get('x-agent-secret', '')
    if not expected or not secrets.compare_digest(expected, provided):
        return JSONResponse({'error': 'Unauthorized'}, status_code=401)
    request.scope['path'] = request.scope['path'].removeprefix('/agent')
    return await call_next(request)
