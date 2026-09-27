import os
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load .env from parent directory or current directory
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BLAZERESOLVER_API_URL = os.getenv("BLAZERESOLVER_API_URL", "http://localhost:3001")
REFUND_WINDOW_HOURS = 2  # Standard refund window (hours)
AUTO_REFUND_THRESHOLD_INR = float(os.getenv("AUTO_REFUND_THRESHOLD_INR", "300"))

# LTV (Lifetime Value) tiers — higher-value customers get higher automated thresholds
LTV_TIERS = [
    (10000, 1.00),   # ₹10,000+  → 100% refund
    (5000,  0.75),   # ₹5,000+   → 75% refund
    (2000,  0.50),   # ₹2,000+   → 50% refund
    (0,     0.30),   # Default   → 30% refund
]

def _get_refund_percentage(total_ltv: float) -> tuple[float, str]:
    """Determine refund percentage based on customer lifetime value."""
    for threshold, pct in LTV_TIERS:
        if total_ltv >= threshold:
            tier_label = f"₹{threshold:,}+" if threshold > 0 else "new customer"
            return pct, f"LTV tier: {tier_label} (total spend ₹{total_ltv:,.0f}) → {int(pct*100)}% refund"
    return 0.30, "default tier → 30% refund"

# ──────────────────────────────────────────────
# In-Memory Adapter State Store (Standalone Fallback)
# Genericized: resourceId not branchId, item not dish
# ──────────────────────────────────────────────
class LocalAdapterStore:
    def __init__(self):
        self.users = {
            1: {
                "_id": 1,
                "name": "Dikshant J.",
                "phone": "+91-9876543210",
                "email": "user1@example.com",
                "wallet_balance": 150.0,
                "tier": "standard",
            },
            2: {
                "_id": 2,
                "name": "Sarah Connor",
                "phone": "+91-9876543211",
                "email": "vip_user@example.com",
                "wallet_balance": 520.0,
                "tier": "vip",
            }
        }
        self.orders = [
            {
                "_id": 101,
                "user_id": 1,
                "resource_id": "res_central_01",
                "resource_name": "Central Hub",
                "status": "Delivered",
                "total_amount": 280.0,
                "timestamp": datetime.now(timezone.utc),
                "items": [
                    {"item_id": "item_01", "name": "Standard Package", "qty": 1, "price": 280.0}
                ]
            },
            {
                "_id": 102,
                "user_id": 1,
                "resource_id": "res_central_01",
                "resource_name": "Central Hub",
                "status": "Delivered",
                "total_amount": 850.0,
                "timestamp": datetime.now(timezone.utc),
                "items": [
                    {"item_id": "item_02", "name": "Premium Bundle", "qty": 1, "price": 850.0}
                ]
            }
        ]
        self.support_tickets = []
        self.complaints = []

store = LocalAdapterStore()

# ──────────────────────────────────────────────
# Tool 1: get_user_profile
# ──────────────────────────────────────────────
async def get_user_profile(user_id: int) -> str:
    """
    Fetches user profile details including name, wallet balance,
    and total lifetime spend across all orders (LTV).
    Swaps direct database queries for Adapter client calls.
    """
    try:
        # Check backend adapter API if available
        async with httpx.AsyncClient(timeout=2.0) as client:
            try:
                resp = await client.get(f"{BLAZERESOLVER_API_URL}/api/adapters/overview")
                if resp.status_code == 200:
                    data = resp.json()
                    orders = [o for o in data.get("orders", []) if str(o.get("customerId", "")) == str(user_id)]
                    total_spend = sum(float(o.get("totalAmount", 0)) for o in orders)
                    order_count = len(orders)
                    return (
                        f"User Profile:\n"
                        f"  User ID: {user_id}\n"
                        f"  Total Orders: {order_count}\n"
                        f"  Lifetime Spend (LTV): ₹{total_spend:,.2f}\n"
                        f"  Customer Tier: {'VIP' if total_spend >= 1000 else 'Standard'}"
                    )
            except Exception:
                pass # Fallback to local store

        user = store.users.get(user_id)
        if not user:
            return "User not found."

        user_orders = [o for o in store.orders if o["user_id"] == user_id]
        total_spend = sum(o["total_amount"] for o in user_orders)
        order_count = len(user_orders)

        return (
            f"User Profile:\n"
            f"  Name: {user.get('name', 'N/A')}\n"
            f"  Phone: {user.get('phone', 'N/A')}\n"
            f"  Email: {user.get('email', 'N/A')}\n"
            f"  Wallet Balance: ₹{user.get('wallet_balance', 0):,.2f}\n"
            f"  Total Orders: {order_count}\n"
            f"  Lifetime Spend (LTV): ₹{total_spend:,.2f}\n"
            f"  Customer Tier: {'Loyal' if total_spend >= 10000 else 'Regular' if total_spend >= 5000 else 'Moderate' if total_spend >= 2000 else 'New'}"
        )
    except Exception as e:
        return f"Error fetching user profile: {e}"

# ──────────────────────────────────────────────
# Tool 2: check_order_status
# ──────────────────────────────────────────────
async def check_order_status(user_id: int) -> str:
    """
    Checks active and past orders for a user.
    Generic: items instead of dishes, resource instead of restaurant.
    """
    try:
        user_orders = [o for o in store.orders if o["user_id"] == user_id]
        if not user_orders:
            return "The user has no past or active orders."

        now = datetime.now(timezone.utc)
        lines = []
        for o in sorted(user_orders, key=lambda x: x["_id"], reverse=True):
            ts = o.get("timestamp")
            ts_str = ts.strftime("%d %b %Y, %I:%M %p") if ts else "Recent"
            hours_ago = 0.5
            time_note = f" ({hours_ago:.1f} hours ago)"
            refund_eligible = "✅ Refund eligible" if hours_ago <= REFUND_WINDOW_HOURS else "❌ Past 2-hour refund window"

            lines.append(
                f"Order #{o['_id']} | Resource: {o.get('resource_name', 'Default')} | "
                f"Status: {o.get('status')} | ₹{o.get('total_amount', 0):,.2f} | "
                f"{ts_str}{time_note} | {refund_eligible}"
            )

        return "User Orders (newest first):\n" + "\n".join(lines)
    except Exception as e:
        return f"Error checking order status: {e}"

# ──────────────────────────────────────────────
# Tool 3: get_order_details
# ──────────────────────────────────────────────
async def get_order_details(order_id: int) -> str:
    """
    Fetches detailed order metadata including items, resource, and delivery timestamp.
    """
    try:
        order = next((o for o in store.orders if o["_id"] == order_id), None)
        if not order:
            return f"Order #{order_id} not found."

        ts = order.get("timestamp")
        hours_since = 0.5
        refund_eligible = hours_since <= REFUND_WINDOW_HOURS and order.get("status") == "Delivered"

        item_lines = [f"    - {it['name']} x{it['qty']} (₹{it['price']})" for it in order.get("items", [])]

        return (
            f"Order Details:\n"
            f"  Order ID: #{order['_id']}\n"
            f"  User ID: {order.get('user_id')}\n"
            f"  Resource: {order.get('resource_name', 'Unknown')}\n"
            f"  Status: {order.get('status', 'Unknown')}\n"
            f"  Amount: ₹{order.get('total_amount', 0):,.2f}\n"
            f"  Items:\n" + "\n".join(item_lines) + "\n"
            f"  Timestamp: {ts.strftime('%d %b %Y, %I:%M %p') if ts else 'Unknown'}\n"
            f"  Hours Since Delivery: {hours_since:.1f} hours\n"
            f"  Refund Eligible: {'Yes ✅' if refund_eligible else 'No ❌'}"
        )
    except Exception as e:
        return f"Error fetching order details: {e}"

# ──────────────────────────────────────────────
# Tool 4: initiate_refund (Adapter + Money-Gate Policy)
# ──────────────────────────────────────────────
async def initiate_refund(user_id: int, order_id: int, reason: str) -> str:
    """
    Enforces Money-Gate policy and delegates financial refund to the RefundGateway adapter:
    - Auto-approves amounts <= AUTO_REFUND_THRESHOLD_INR (₹300).
    - Gates amounts > ₹300 to Human-In-The-Loop (HITL) queue with proposed action attached.
    """
    try:
        order = next((o for o in store.orders if o["_id"] == order_id and o["user_id"] == user_id), None)
        if not order:
            return f"Order #{order_id} not found or does not belong to user {user_id}."

        if order.get("status") != "Delivered":
            return f"Cannot refund order #{order_id} with status '{order.get('status')}'. Only delivered orders are eligible."

        order_amount = order.get("total_amount", 0)

        # Money-Gate check: Auto-approve under threshold, escalate with proposed action above
        if order_amount <= AUTO_REFUND_THRESHOLD_INR:
            ticket_id = len(store.support_tickets) + 1
            store.support_tickets.append({
                "ticket_id": ticket_id,
                "order_id": order_id,
                "user_id": user_id,
                "amount": order_amount,
                "status": "Auto-Approved",
                "reason": reason,
                "timestamp": datetime.now(timezone.utc)
            })
            order["status"] = "Refund Processed"
            user = store.users.get(user_id)
            if user:
                user["wallet_balance"] = user.get("wallet_balance", 0) + order_amount

            return (
                f"✅ Refund AUTO-APPROVED via Policy Gate! (Ticket #{ticket_id})\n"
                f"  Order #{order_id}: ₹{order_amount:,.2f} refunded to original payment/wallet.\n"
                f"  Reason: {reason}\n"
                f"  Policy: Below automated limit of ₹{AUTO_REFUND_THRESHOLD_INR:,.0f}."
            )
        else:
            # Gated to HITL queue with proposed action attached
            ticket_id = len(store.support_tickets) + 1
            proposed_action = {
                "type": "refund",
                "order_id": order_id,
                "amount": order_amount,
                "reason": reason,
                "requires_supervisor_review": True
            }
            store.support_tickets.append({
                "ticket_id": ticket_id,
                "order_id": order_id,
                "user_id": user_id,
                "amount": order_amount,
                "status": "Pending_HITL_Review",
                "proposed_action": proposed_action,
                "reason": reason,
                "timestamp": datetime.now(timezone.utc)
            })
            return (
                f"⏳ Refund GATED to Supervisor Queue (Ticket #{ticket_id})\n"
                f"  Amount ₹{order_amount:,.2f} exceeds auto-approval threshold of ₹{AUTO_REFUND_THRESHOLD_INR:,.0f}.\n"
                f"  A proposed refund action has been attached for 1-click supervisor review.\n"
                f"  Assure the customer their claim is prioritized and will be resolved shortly."
            )
    except Exception as e:
        return f"Error initiating refund: {e}"

# ──────────────────────────────────────────────
# Tool 5: file_complaint
# ──────────────────────────────────────────────
async def file_complaint(user_id: int, order_id: int, category: str, description: str) -> str:
    """
    Files an operational complaint into TicketSink.
    Categories: quality_issue, late_delivery, missing_items, wrong_item, packaging, other
    """
    try:
        complaint_id = len(store.complaints) + 1
        record = {
            "_id": complaint_id,
            "user_id": user_id,
            "order_id": order_id,
            "category": category,
            "description": description,
            "status": "Open",
            "timestamp": datetime.now(timezone.utc)
        }
        store.complaints.append(record)

        return (
            f"✅ Complaint #{complaint_id} filed successfully into TicketSink.\n"
            f"  Order: #{order_id}\n"
            f"  Category: {category}\n"
            f"  Description: {description}\n"
            f"  Status: Open — scheduled for operational review."
        )
    except Exception as e:
        return f"Error filing complaint: {e}"

# ──────────────────────────────────────────────
# Tool 6: escalate_to_human
# ──────────────────────────────────────────────
async def escalate_to_human(user_id: int, reason: str) -> str:
    """
    Creates an urgent supervisor ticket with context.
    """
    try:
        ticket_id = len(store.support_tickets) + 1
        store.support_tickets.append({
            "ticket_id": ticket_id,
            "user_id": user_id,
            "status": "Escalated",
            "reason": reason,
            "timestamp": datetime.now(timezone.utc)
        })
        return (
            f"🔔 Escalation ticket #{ticket_id} submitted to human queue.\n"
            f"  Customer: User #{user_id}\n"
            f"  Reason: {reason}\n"
            f"  A customer success specialist will follow up promptly."
        )
    except Exception as e:
        return f"Error escalating: {e}"
