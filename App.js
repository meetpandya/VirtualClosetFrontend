import os
import time
import json
import sqlite3
import logging
import asyncio
import base64
from io import BytesIO
from typing import List
from PIL import Image

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
from rembg import remove, new_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("atelier-backend")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_NAME = os.path.join(BASE_DIR, "closet.db")

os.makedirs(UPLOAD_DIR, exist_ok=True)

api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

class DeleteItemsRequest(BaseModel):
    item_ids: List[int]

def init_db():
    conn = sqlite3.connect(DB_NAME, timeout=10.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clothing_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT,
            category TEXT,
            sub_type TEXT,
            primary_color TEXT,
            pattern TEXT,
            warmth_level INTEGER,
            water_resistant INTEGER,
            target_gender TEXT,
            image_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_id ON clothing_items(user_id)")
    conn.commit()
    conn.close()

init_db()

app = FastAPI(
    title="Atelier API",
    description="Backend service for Atelier Digital Wardrobe"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-User-Id", "x-user-id"],
    expose_headers=["*", "X-User-Id", "x-user-id"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def delete_garment_files_and_records(item_ids: List[int], user_id: str) -> int:
    conn = sqlite3.connect(DB_NAME, timeout=10.0)
    cursor = conn.cursor()
    placeholders = ",".join(["?"] * len(item_ids))
    
    cursor.execute(f"SELECT id, image_path FROM clothing_items WHERE id IN ({placeholders}) AND user_id = ?", (*item_ids, user_id))
    rows = cursor.fetchall()
    
    cursor.execute(f"DELETE FROM clothing_items WHERE id IN ({placeholders}) AND user_id = ?", (*item_ids, user_id))
    conn.commit()
    conn.close()

    deleted_count = len(rows)
    for row in rows:
        rel_path = row[1]
        if rel_path and rel_path.startswith("/uploads/"):
            clean_rel = rel_path.lstrip("/")
            full_path = os.path.join(BASE_DIR, clean_rel)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except Exception:
                    pass
    return deleted_count


async def process_single_garment_background(raw_bytes: bytes, filename: str, gender: str, user_id: str):
    logger.info(f"--- [BACKGROUND] Started processing for {filename} ---")
    item_id = None
    user_upload_dir = os.path.join(UPLOAD_DIR, user_id)
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # 1. Instant save of messy photo for zero-lag UI
    messy_filepath = os.path.join(user_upload_dir, filename)
    try:
        def save_messy():
            img = Image.open(BytesIO(raw_bytes)).convert("RGB")
            img.thumbnail((800, 800))
            img.save(messy_filepath, format="JPEG", quality=80)
        
        await asyncio.to_thread(save_messy)
        initial_image_path = f"/uploads/{user_id}/{filename}"

        conn = sqlite3.connect(DB_NAME, timeout=10.0)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO clothing_items 
            (user_id, name, category, sub_type, primary_color, pattern, warmth_level, water_resistant, target_gender, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, "Processing...", "Processing", "General", "Neutral", "Solid", 3, 0, gender, initial_image_path))
        item_id = cursor.lastrowid
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Instant save failed: {e}")
        return

    # 2. AI Background Removal (rembg) & Transparent PNG Generation
    try:
        clean_filename = filename.replace(".jpg", ".png").replace(".jpeg", ".png")
        if not clean_filename.endswith('.png'):
            clean_filename += '.png'
            
        clean_filepath = os.path.join(user_upload_dir, clean_filename)
        clean_image_path = f"/uploads/{user_id}/{clean_filename}"

        def remove_bg_task():
            # Session explicitly constrained to u2netp (lite) and CPU to prevent OOM kills
            session = new_session(model_name="u2netp", providers=['CPUExecutionProvider'])
            result_bytes = remove(raw_bytes, session=session)
            
            clean_img = Image.open(BytesIO(result_bytes)).convert("RGBA")
            clean_img.thumbnail((800, 800))
            clean_img.save(clean_filepath, format="PNG")
            return clean_img

        clean_img = await asyncio.to_thread(remove_bg_task)
        
        # Cleanup original messy image from disk to save space
        if os.path.exists(messy_filepath):
            os.remove(messy_filepath)

    except Exception as e:
        logger.error(f"Background removal failed: {e}")
        return

    # 3. OpenAI GPT-4o-mini Tagging (using the clean cutout image)
    if client is not None:
        try:
            # Convert the clean PIL Image to a base64 string for OpenAI
            buffered = BytesIO()
            clean_img.save(buffered, format="PNG")
            base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

            category_options = "Tops, Bottoms, Outerwear, Footwear" if gender.lower() == "male" else "Tops, Bottoms, One-Piece, Outerwear, Footwear"
            prompt_analysis = f"""
            Analyze this {gender} garment carefully.
            Return ONLY a JSON object with:
            - name: Short descriptive item name (e.g. "Grey Diamond Polo")
            - category: Select strictly from [{category_options}]
            - sub_type: Specific subcategory
            - color: Main color
            """
            
            def call_openai():
                return client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"}, # Forces strict JSON output
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt_analysis},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{base64_image}"
                                    }
                                }
                            ]
                        }
                    ]
                )

            res = await asyncio.wait_for(asyncio.to_thread(call_openai), timeout=30.0)
            
            # Extract JSON from OpenAI response
            raw_json = res.choices[0].message.content.strip()
            metadata = json.loads(raw_json)

            # 4. Update Database with new tags AND the new transparent PNG path
            conn = sqlite3.connect(DB_NAME, timeout=10.0)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE clothing_items 
                SET name = ?, category = ?, sub_type = ?, primary_color = ?, image_path = ?
                WHERE id = ?
            """, (
                metadata.get("name", f"{gender} Garment"),
                metadata.get("category", "Tops"),
                metadata.get("sub_type", "General"),
                metadata.get("color", "Neutral"),
                clean_image_path,
                item_id
            ))
            conn.commit()
            conn.close()
            logger.info(f"--- [BACKGROUND] Success: Cutout & Tagged #{item_id} via OpenAI ---")
        except Exception as e:
            logger.error(f"OpenAI tagging failed: {e}")


@app.post("/api/wardrobe/upload")
async def upload_garment(
    background_tasks: BackgroundTasks, file: UploadFile = File(...), gender: str = Form("Female"), x_user_id: str = Header(default="user_demo_123")
):
    raw_bytes = await file.read()
    await file.close()
    filename = f"garment_{int(time.time())}.jpg"
    background_tasks.add_task(process_single_garment_background, raw_bytes, filename, gender, x_user_id)
    return {"status": "success", "message": "Upload queued."}


@app.get("/api/items")
async def get_wardrobe_items(gender: str = "Female", x_user_id: str = Header(default="user_demo_123")):
    conn = sqlite3.connect(DB_NAME, timeout=10.0)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, category, sub_type, primary_color, image_path, created_at FROM clothing_items WHERE target_gender = ? AND user_id = ? ORDER BY id DESC", (gender, x_user_id))
    rows = cursor.fetchall()
    conn.close()

    items = [{"id": r[0], "name": r[1], "category": r[2], "sub_type": r[3], "color": r[4], "image_path": r[5], "created_at": r[6]} for r in rows]
    return {"status": "success", "items": items}

@app.delete("/api/items/{item_id}")
async def delete_single_item(item_id: int, x_user_id: str = Header(default="user_demo_123")):
    count = delete_garment_files_and_records([item_id], x_user_id)
    return {"status": "success", "message": "Deleted"} if count else HTTPException(status_code=404)

@app.delete("/api/items/batch-delete")
async def delete_multiple_items(payload: DeleteItemsRequest, x_user_id: str = Header(default="user_demo_123")):
    count = delete_garment_files_and_records(payload.item_ids, x_user_id)
    return {"status": "success", "deleted_count": count}