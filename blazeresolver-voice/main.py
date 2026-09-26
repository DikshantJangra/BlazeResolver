import os
import sys
import asyncio
import json
import base64
import websockets
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tools import (
    get_user_profile,
    check_order_status,
    get_order_details,
    initiate_refund,
    file_complaint,
    escalate_to_human,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("blazeresolver_voice_server")

app = FastAPI(title="BlazeResolver Gemini Multimodal Voice Agent Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from telephony_bridge import telephony_router
app.include_router(telephony_router)

@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "service": "blazeresolver-voice-server",
        "harness": "BlazeResolver Operational Voice Agent",
        "version": "1.0.0"
    }

# ──────────────────────────────────────────────
# Gemini Live API Tool Declarations (Generic)
# ──────────────────────────────────────────────
TOOL_DECLARATIONS = [
    {
        "name": "get_user_profile",
        "description": "Fetches the customer's profile including name, phone, email, wallet balance, order count, and lifetime value (LTV).",
        "parameters": {
            "type": "OBJECT",
            "properties": {"user_id": {"type": "INTEGER", "description": "The user's ID"}},
            "required": ["user_id"]
        }
    },
    {
        "name": "check_order_status",
        "description": "Lists customer orders with status, total amount, timestamp, and refund eligibility within the policy window.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"user_id": {"type": "INTEGER", "description": "The user's ID"}},
            "required": ["user_id"]
        }
    },
    {
        "name": "get_order_details",
        "description": "Gets detailed information for an order including items, fulfilled resources, timestamps, and amounts.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"order_id": {"type": "INTEGER", "description": "The order ID to look up"}},
            "required": ["order_id"]
        }
    },
    {
        "name": "initiate_refund",
        "description": "Processes a refund for a delivered order. Gated by money policy: amounts under ₹300 are auto-approved; higher amounts attach a proposed action for human supervisor review.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "user_id": {"type": "INTEGER", "description": "The user's ID"},
                "order_id": {"type": "INTEGER", "description": "The order ID to refund"},
                "reason": {"type": "STRING", "description": "Reason for the refund request"}
            },
            "required": ["user_id", "order_id", "reason"]
        }
    },
    {
        "name": "file_complaint",
        "description": "Files an operational complaint against an order into TicketSink. Categories: quality_issue, late_delivery, missing_items, wrong_item, packaging, other.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "user_id": {"type": "INTEGER", "description": "The user's ID"},
                "order_id": {"type": "INTEGER", "description": "The order ID the complaint targets"},
                "category": {"type": "STRING", "description": "Complaint category"},
                "description": {"type": "STRING", "description": "Detailed description of the issue"}
            },
            "required": ["user_id", "order_id", "category", "description"]
        }
    },
    {
        "name": "escalate_to_human",
        "description": "Escalates the call to a human supervisor when policy thresholds are exceeded, the customer explicitly insists on human support, or complex intervention is required.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "user_id": {"type": "INTEGER", "description": "The user's ID"},
                "reason": {"type": "STRING", "description": "Summary of reason for escalation"}
            },
            "required": ["user_id", "reason"]
        }
    }
]

def _build_system_instruction(active_user_id: str) -> str:
    return f"""You are a live voice customer service agent powered by BlazeResolver.
You sound warm, natural, empathetic, and professional — like a real human on a telephone call.
Keep responses EXTREMELY concise and conversational (1-2 sentences maximum).

## CORE OPERATIONAL PRINCIPLES
1. LLM decides conversational intent, deterministic policy code executes mutations.
2. Under ₹300: Refunds and credits are auto-approved instantly.
3. Over ₹300: High-value actions are gated to a human supervisor queue with your proposed action attached for 1-click approval.
4. Always check order details with `get_order_details` or `check_order_status` before confirming any operational status.
5. Use quick conversational fillers when calling tools: "Checking that for you right now", "One moment please".
6. If the customer is angry or demands a supervisor, use `escalate_to_human`.

The active user ID is {active_user_id}. Always use this ID when querying profile or orders unless specified.
"""

# ──────────────────────────────────────────────
# Tool call dispatcher
# ──────────────────────────────────────────────
async def dispatch_tool_call(name: str, args: dict, active_user_id: str) -> str:
    """Route tool calls deterministically to the adapter bridge."""
    uid = int(args.get("user_id", active_user_id))

    if name == "get_user_profile":
        return await get_user_profile(user_id=uid)
    elif name == "check_order_status":
        return await check_order_status(user_id=uid)
    elif name == "get_order_details":
        oid = int(args.get("order_id", 0))
        return await get_order_details(order_id=oid)
    elif name == "initiate_refund":
        oid = int(args.get("order_id", 0))
        reason = str(args.get("reason", ""))
        return await initiate_refund(user_id=uid, order_id=oid, reason=reason)
    elif name == "file_complaint":
        oid = int(args.get("order_id", 0))
        category = str(args.get("category", "other"))
        description = str(args.get("description", ""))
        return await file_complaint(user_id=uid, order_id=oid, category=category, description=description)
    elif name == "escalate_to_human":
        reason = str(args.get("reason", ""))
        return await escalate_to_human(user_id=uid, reason=reason)
    else:
        logger.warning("Unknown tool called: %s", name)
        return "Error: Unknown tool invoked."

# ──────────────────────────────────────────────
# WebSocket Handler & Gemini Multimodal Live Proxy
# ──────────────────────────────────────────────
async def _handle_voice_websocket(websocket: WebSocket):
    await websocket.accept()

    active_user_id = websocket.query_params.get("user_id", "1")
    system_instruction = _build_system_instruction(active_user_id)

    logger.info(f"Client connected to BlazeResolver Voice WebSocket (User ID: {active_user_id})")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. Operating in mock audio loopback mode.")
        # Provide diagnostic error or mock fallback
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "Voice agent notice: GEMINI_API_KEY is not set on server. Set GEMINI_API_KEY in environment to enable live voice."
        }))

    gemini_ws_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={api_key}"

    try:
        async with websockets.connect(gemini_ws_url) as gemini_ws:
            logger.info("Connected to Gemini Multimodal Live WebSocket API!")

            # Send setup configuration
            setup_message = {
                "setup": {
                    "model": "models/gemini-2.0-flash-exp",
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "tools": [{"functionDeclarations": TOOL_DECLARATIONS}],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {"voiceName": "Kore"}
                            }
                        }
                    }
                }
            }
            await gemini_ws.send(json.dumps(setup_message))

            async def receive_from_client():
                try:
                    while True:
                        message = await websocket.receive()
                        if "bytes" in message:
                            b64_audio = base64.b64encode(message["bytes"]).decode("utf-8")
                            realtime_payload = {
                                "realtimeInput": {
                                    "audio": {
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": b64_audio
                                    }
                                }
                            }
                            await gemini_ws.send(json.dumps(realtime_payload))
                        elif "text" in message:
                            try:
                                data = json.loads(message["text"])
                                if data.get("type") == "text":
                                    client_content = {
                                        "clientContent": {
                                            "turns": [{
                                                "role": "user",
                                                "parts": [{"text": data["text"]}]
                                            }],
                                            "turnComplete": True
                                        }
                                    }
                                    await gemini_ws.send(json.dumps(client_content))
                            except json.JSONDecodeError:
                                pass
                except WebSocketDisconnect:
                    logger.info("Client disconnected from voice websocket.")
                except Exception as e:
                    logger.error(f"Error in client reader: {e}")

            async def receive_from_gemini():
                try:
                    async for raw_msg in gemini_ws:
                        response = json.loads(raw_msg)

                        # Audio / Content from server
                        server_content = response.get("serverContent")
                        if server_content:
                            model_turn = server_content.get("modelTurn")
                            if model_turn:
                                for part in model_turn.get("parts", []):
                                    # Audio stream
                                    inline_data = part.get("inlineData")
                                    if inline_data and inline_data.get("mimeType", "").startswith("audio/"):
                                        audio_bytes = base64.b64decode(inline_data["data"])
                                        await websocket.send_bytes(audio_bytes)
                                    # Text transcription
                                    text_part = part.get("text")
                                    if text_part:
                                        await websocket.send_text(json.dumps({"type": "transcript", "text": text_part}))

                            if server_content.get("turnComplete"):
                                await websocket.send_text(json.dumps({"type": "turn_complete"}))

                        # Tool Call requests from Gemini Live
                        tool_call = response.get("toolCall")
                        if tool_call:
                            function_calls = tool_call.get("functionCalls", [])
                            function_responses = []

                            for call in function_calls:
                                call_id = call.get("id")
                                name = call.get("name")
                                args = call.get("args", {})

                                logger.info(f"Gemini invoked tool: {name}({args})")
                                result_str = await dispatch_tool_call(name, args, active_user_id)

                                function_responses.append({
                                    "id": call_id,
                                    "name": name,
                                    "response": {"output": result_str}
                                })

                            tool_response_payload = {
                                "toolResponse": {
                                    "functionResponses": function_responses
                                }
                            }
                            await gemini_ws.send(json.dumps(tool_response_payload))

                except Exception as e:
                    logger.error(f"Error in gemini reader: {e}")

            # Run client and gemini streams concurrently
            await asyncio.gather(receive_from_client(), receive_from_gemini())

    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
        try:
            await websocket.close(code=1011, reason="Voice bridge encountered an error.")
        except Exception:
            pass

@app.websocket("/ws")
async def voice_websocket_root(websocket: WebSocket):
    await _handle_voice_websocket(websocket)

@app.websocket("/ws/voice")
async def voice_websocket_path(websocket: WebSocket):
    await _handle_voice_websocket(websocket)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
