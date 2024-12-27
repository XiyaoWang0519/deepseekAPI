from fastapi import FastAPI, HTTPException, Depends, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Dict
import os
from dotenv import load_dotenv
from openai import OpenAI, AsyncOpenAI
from sse_starlette.sse import EventSourceResponse
import asyncio
import re
import json

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

# Initialize OpenAI clients with DeepSeek configuration
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1",
    timeout=60.0,
    max_retries=2
)

async_client = AsyncOpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1",
    timeout=60.0,
    max_retries=2
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

def buffer_tokens(text: str) -> List[str]:
    """Split text into complete words/tokens."""
    # Split on word boundaries, keeping punctuation and whitespace
    words = re.findall(r'\S+|\s+', text)
    return words

async def event_generator(client: AsyncOpenAI, messages_data: ChatRequest):
    try:
        print("Creating streaming request with messages:", [{"role": msg.role, "content": msg.content} for msg in messages_data.messages])
        stream = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": msg.role, "content": msg.content} for msg in messages_data.messages],
            stream=True
        )
        
        buffer = ""
        async for chunk in stream:
            print(f"Received chunk: {chunk}")
            if chunk.choices[0].delta.content:
                buffer += chunk.choices[0].delta.content
                words = buffer_tokens(buffer)
                if words:
                    buffer = ""
                    # Buffer words until we have a complete phrase or sentence
                    complete_phrase = ' '.join(words)
                    if complete_phrase.strip():
                        print(f"Sending phrase: {complete_phrase}")
                        yield {
                            "event": "message",
                            "data": complete_phrase
                        }
        
        if buffer:
            print(f"Sending final buffer: {buffer}")
            yield {
                "event": "message",
                "data": buffer
            }
            
        yield {
            "event": "done",
            "data": ""
        }
        
    except Exception as e:
        print(f"Error in event_generator: {str(e)}")
        print(f"Full error details: {repr(e)}")
        yield {
            "event": "error",
            "data": str(e)
        }

@app.get("/chat/stream")
async def stream_chat(
    request: Request,
    messages: str,
    token: str
):
    # Validate token manually since we can't use Depends with SSE
    try:
        print(f"Raw token received: {token[:10]}...")  # Log first 10 chars of raw token
        
        # Clean and validate token
        clean_token = token.strip()
        if not clean_token:
            raise ValueError("Empty token received")
            
        print(f"Clean token: {clean_token[:10]}...")  # Log first 10 chars of clean token
        payload = decode_access_token(clean_token)
        
        if not payload:
            print("Token decode failed")
            raise HTTPException(
                status_code=401,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if "sub" not in payload:
            print("Token missing 'sub' claim")
            raise HTTPException(
                status_code=401,
                detail="Invalid token claims",
                headers={"WWW-Authenticate": "Bearer"},
            )
        current_user = payload["sub"]
        print(f"Authenticated user: {current_user}")
    except Exception as e:
        print(f"Token validation error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        print(f"Received messages: {messages[:100]}...")  # Log first 100 chars of messages
        messages_data = ChatRequest(messages=json.loads(messages))
        print(f"Parsed messages: {str(messages_data)[:100]}...")  # Log parsed messages
        
        # Return streaming response with CORS headers
        return EventSourceResponse(
            event_generator(async_client, messages_data),
            media_type="text/event-stream",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in stream_chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
