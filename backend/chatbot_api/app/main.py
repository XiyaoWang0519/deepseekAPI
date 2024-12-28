from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List
import os
from dotenv import load_dotenv
from openai import OpenAI

from app.auth import (
    create_user,
    verify_password,
    create_access_token,
    decode_access_token,
    get_user
)

# Load environment variables
load_dotenv()

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize OpenAI client with DeepSeek configuration
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL")
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload.get("sub")

@app.post("/register")
async def register(user: UserCreate):
    if not create_user(user.username, user.password):
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    return {"message": "User successfully registered"}

@app.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

from fastapi.responses import StreamingResponse
import asyncio

@app.post("/chat")
async def chat(request: ChatRequest, current_user: str = Depends(get_current_user)):
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": msg.role, "content": msg.content} for msg in request.messages],
            stream=False
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
async def stream_chat(request: ChatRequest, current_user: str = Depends(get_current_user)):
    try:
        async def generate():
            try:
                buffer = ""
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[{"role": msg.role, "content": msg.content} for msg in request.messages],
                    stream=True
                )
                
                for chunk in response:
                    if hasattr(chunk.choices[0], 'delta') and hasattr(chunk.choices[0].delta, 'content'):
                        content = chunk.choices[0].delta.content
                        if content:
                            buffer += content
                            # Send complete words/sentences
                            if ' ' in buffer or '\n' in buffer or buffer.endswith('.'):
                                yield buffer.encode('utf-8')
                                buffer = ""
                                await asyncio.sleep(0.01)  # Small delay for natural flow
                
                # Send any remaining content
                if buffer:
                    yield buffer.encode('utf-8')
            except Exception as e:
                yield str(e).encode('utf-8')
                raise

        return StreamingResponse(generate(), media_type='text/plain')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
