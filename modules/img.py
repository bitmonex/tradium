from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
import os
from datetime import datetime
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")
UPLOAD_FOLDER = "static/uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@router.get("/img", response_class=HTMLResponse)
async def img_page(request: Request):
    files = sorted(os.listdir(UPLOAD_FOLDER), reverse=True)
    file_data = [{"name": f, "date": datetime.fromtimestamp(os.path.getmtime(os.path.join(UPLOAD_FOLDER, f))).strftime("%d.%m.%Y %H:%M")} for f in files]
    return templates.TemplateResponse("img.html", {"request": request, "files": file_data})

@router.post("/img/upload")
async def upload_image(file: UploadFile = File(...)):
    if file.filename:
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())
        
        return JSONResponse(content={"message": "File uploaded", "url": f"/static/uploads/{filename}"})
    return JSONResponse(content={"error": "No file uploaded"}, status_code=400)
