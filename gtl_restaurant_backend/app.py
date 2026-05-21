import os
import json
import csv
import sys
import re
import socket
from urllib.parse import quote_plus, urlparse
from pathlib import Path
from functools import wraps
import pyotp
import qrcode
import io
import base64
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
import random
import secrets
from flask import Flask, request, redirect, session, url_for, jsonify, make_response
from flask_cors import CORS
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.consumer import oauth_authorized
from oauthlib.oauth2.rfc6749.errors import InvalidClientError, OAuth2Error
from db_connection import init_db
from admin_dashboard_routes import create_admin_dashboard_blueprint
from admin_menu_routes import create_admin_menu_blueprint
from admin_order_routes import create_admin_order_blueprint
from admin_table_routes import create_admin_table_blueprint
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# Load credentials from .env so developers can keep configs local.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR   = os.path.join(BASE_DIR, "static")
UPLOAD_DIR   = os.path.join(STATIC_DIR, "uploads")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
CHATBOT_ROOT = PROJECT_ROOT / "restaurant_chatbot_prototype"

if CHATBOT_ROOT.exists():
    chatbot_path = str(CHATBOT_ROOT)
    if chatbot_path not in sys.path:
        sys.path.insert(0, chatbot_path)

app = Flask(__name__, static_folder=STATIC_DIR)

app.secret_key = os.environ.get("SECRET_KEY", "change-me-in-production")

# ── CORS (for React frontend) ────────────────────────────────────────────────
# Allow the configured frontend origin to call this API and send cookies.
cors_origins = [
    os.environ.get("FRONTEND_URL", "http://localhost:5173"),
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
public_frontend = os.environ.get("PUBLIC_FRONTEND_URL", "").strip()
if public_frontend:
    cors_origins.append(public_frontend)

CORS(
    app,
    supports_credentials=True,
    origins=cors_origins,
)

# ── Google OAuth ───────────────────────────────────────────────────────────
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
PUBLIC_FRONTEND_URL = os.environ.get("PUBLIC_FRONTEND_URL", "")
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # dev only

google_client_id      = os.environ.get("GOOGLE_CLIENT_ID")
google_client_secret  = os.environ.get("GOOGLE_CLIENT_SECRET")
google_redirect_uri   = os.environ.get(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:5000/google-login/authorized",
)
google_auth_enabled   = bool(google_client_id and google_client_secret)
google_bp             = None
google_login_url      = None

if google_auth_enabled:
    google_bp = make_google_blueprint(
        client_id      = google_client_id,
        client_secret  = google_client_secret,
        scope          = [
            "openid",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
        login_url      = "/",
        authorized_url = "/authorized",
    )
    app.register_blueprint(google_bp, url_prefix="/google-login")
    with app.test_request_context():
        google_login_url = url_for("google.login")

app.config["GOOGLE_AUTH_ENABLED"] = google_auth_enabled
app.config["GOOGLE_LOGIN_URL"]    = google_login_url
app.config["GOOGLE_REDIRECT_URI"] = google_redirect_uri
app.config["FRONTEND_URL"]        = FRONTEND_URL
app.config["PUBLIC_FRONTEND_URL"] = PUBLIC_FRONTEND_URL

mysql = init_db(app)

try:
    from chatbot_prototype.model.service import ChatbotService
except Exception as chatbot_import_error:
    ChatbotService = None
    app.logger.warning("Chatbot assistant unavailable: %s", chatbot_import_error)

assistant_service = ChatbotService() if ChatbotService else None

# OTP validity window (seconds).
OTP_TTL_SECONDS = 120


def _frontend_login_url(message=None):
    login_url = f"{FRONTEND_URL}/login"
    if not message:
        return login_url
    separator = "&" if "?" in login_url else "?"
    return f"{login_url}{separator}error={quote_plus(message)}"


def _resolve_qr_frontend_url():
    configured = str(app.config.get("FRONTEND_URL", FRONTEND_URL) or FRONTEND_URL).rstrip("/")
    parsed = urlparse(configured)
    frontend_scheme = parsed.scheme or request.scheme or "http"
    frontend_port = parsed.port or 5173
    configured_host = (parsed.hostname or "").lower()

    # If this request arrived over LAN/public host (for example, phone -> laptop IP),
    # use that host for QR links so stale .env IP values never break scanning.
    request_host_header = (
        request.headers.get("X-Forwarded-Host")
        or request.headers.get("Host")
        or request.host
        or ""
    )
    request_host = request_host_header.split(",", 1)[0].strip().split(":", 1)[0].strip().lower()
    if request_host and request_host not in {"localhost", "127.0.0.1", "::1"}:
        return f"{frontend_scheme}://{request_host}:{frontend_port}"

    configured_public = str(app.config.get("PUBLIC_FRONTEND_URL", "") or "").strip()
    if configured_public:
        parsed_public = urlparse(configured_public)
        public_host = (parsed_public.hostname or "").strip().lower()
        if public_host and public_host not in {"localhost", "127.0.0.1", "::1"}:
            return configured_public.rstrip("/")

    if configured_host and configured_host not in {"localhost", "127.0.0.1", "::1"}:
        return configured

    if configured_host in {"localhost", "127.0.0.1"}:
        candidate_host = _detect_lan_host()
        if candidate_host:
            return f"{frontend_scheme}://{candidate_host}:{frontend_port}"
    return configured


def _detect_lan_host():
    preferred = os.environ.get("LAN_HOST", "").strip()
    if preferred:
        return preferred
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        if ip and ip not in {"127.0.0.1", "0.0.0.0"}:
            return ip
    except Exception:
        return ""
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass
    return ""


@app.errorhandler(InvalidClientError)
def handle_invalid_client_error(error):
    app.logger.error("Google OAuth invalid client: %s", error)
    if request.path.startswith("/google-login"):
        return redirect(_frontend_login_url("Google sign-in is not configured correctly. Use user ID and password login or fix the Google OAuth credentials."))
    return json_response("OAuth client configuration is invalid.", success=False, status=500)


@app.errorhandler(OAuth2Error)
def handle_oauth2_error(error):
    app.logger.error("OAuth error on %s: %s", request.path, error)
    if request.path.startswith("/google-login"):
        return redirect(_frontend_login_url("Google sign-in failed. Verify the Google OAuth client ID, secret, and authorized redirect URI."))
    return json_response("OAuth authentication failed.", success=False, status=400)


# ── Helper ─────────────────────────────────────────────────────────────────
def get_current_user():
    return session.get("user_id") or request.headers.get("X-User-Id", "").strip() or None


def json_response(message, success=True, data=None, status=200, meta=None):
    payload = {"success": success, "message": message}
    if data is not None:
        payload["data"] = data
    if meta is not None:
        payload["meta"] = meta
    return make_response(jsonify(payload), status)


def _build_qr_data_uri(target_url):
    image = qrcode.make(target_url)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _get_request_data():
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict() if request.form else {}


def _parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    value = str(value).strip().lower()
    return value in {"1", "true", "yes", "y", "on"}


def _parse_pagination(default_size=20, max_size=200):
    page = int(request.args.get("page", 1) or 1)
    page_size = int(request.args.get("page_size", default_size) or default_size)
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = default_size
    page_size = min(page_size, max_size)
    offset = (page - 1) * page_size
    return page, page_size, offset


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_time(value):
    if not value:
        return None
    raw = str(value).strip()
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p"):
        try:
            return datetime.strptime(raw, fmt).time().strftime("%H:%M:%S")
        except ValueError:
            continue
    return None


def _assistant_unavailable_response():
    return json_response(
        "The AI assistant is not available right now.",
        success=False,
        status=503,
        meta={"assistant_available": False},
    )


def _apply_date_range(clauses, params, column="created_at"):
    start_date = _parse_date(request.args.get("start_date"))
    end_date = _parse_date(request.args.get("end_date"))
    if start_date:
        clauses.append(f"DATE({column}) >= %s")
        params.append(start_date.isoformat())
    if end_date:
        clauses.append(f"DATE({column}) <= %s")
        params.append(end_date.isoformat())


def _get_current_user_record():
    user_id = session.get("user_id") or request.headers.get("X-User-Id", "").strip()
    if not user_id:
        return None
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT user_id, email, full_name, role, is_active
            FROM users
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "user_id": row[0],
            "email": row[1],
            "full_name": row[2],
            "role": row[3],
            "is_active": bool(row[4]),
        }
    finally:
        cur.close()


ASSISTANT_ACCOUNT_PATTERN = re.compile(
    r"\b(account|profile|my details|my info|my information|my email|my phone|my role|last login)\b",
    re.I,
)
ASSISTANT_TABLE_PATTERN = re.compile(
    r"\b(table|tables|seat|seats|availability|available tables?)\b",
    re.I,
)
ASSISTANT_BOOKING_PATTERN = re.compile(
    r"\b(book|booking|reservation|reserve|table for)\b",
    re.I,
)
ASSISTANT_ORDER_PATTERN = re.compile(
    r"\b(order|orders|track|tracking|payment status|latest order|my order)\b",
    re.I,
)
ASSISTANT_MENU_QR_PATTERN = re.compile(
    r"\b(scan\s*qr(?:\s*for\s*menu)?|qr\s*(?:for\s*)?menu|menu\s*qr)\b",
    re.I,
)


def _assistant_extract_numeric_order_id(message: str) -> int | None:
    patterns = (
        r"\border\s*#?\s*(\d{1,10})\b",
        r"\btracking\s*#?\s*(\d{1,10})\b",
        r"\bstatus\s+(?:for|of)\s+(\d{1,10})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, message, re.I)
        if match:
            return int(match.group(1))
    return None


def _assistant_extract_guest_count(message: str) -> int | None:
    patterns = (
        r"\bfor\s+(\d{1,2})\b",
        r"\b(\d{1,2})\s+(?:guests?|people|persons|seats?)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, message, re.I)
        if match:
            return int(match.group(1))
    return None


def _assistant_parse_order_items(raw_items):
    if not raw_items:
        return []
    if isinstance(raw_items, str):
        try:
            raw_items = json.loads(raw_items)
        except Exception:
            return []
    return raw_items if isinstance(raw_items, list) else []


def _assistant_resolve_live_user(raw_user_id: str | None):
    if not raw_user_id:
        return None
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, email, full_name, phone, role, is_active, last_login_at, created_at
            FROM users
            WHERE user_id = %s OR CAST(id AS CHAR) = %s
            LIMIT 1
            """,
            (raw_user_id, raw_user_id),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": int(row[0]),
            "user_id": row[1],
            "email": row[2],
            "full_name": row[3] or row[1],
            "phone": row[4] or "",
            "role": row[5],
            "is_active": bool(row[6]),
            "last_login_at": row[7].isoformat() if row[7] else None,
            "created_at": row[8].isoformat() if row[8] else None,
        }
    finally:
        cur.close()


def _assistant_user_tokens(user: dict | None, raw_user_id: str | None) -> list[str]:
    tokens = []
    for value in (
        raw_user_id,
        user.get("id") if user else None,
        user.get("user_id") if user else None,
    ):
        if value is None:
            continue
        token = str(value).strip()
        if token and token not in tokens:
            tokens.append(token)
    return tokens


def _assistant_fetch_live_order(user_tokens: list[str], explicit_order_id: int | None = None):
    cur = mysql.connection.cursor()
    try:
        params = []
        where_clauses = []
        if explicit_order_id is not None:
            where_clauses.append("o.id = %s")
            params.append(explicit_order_id)
        elif user_tokens:
            placeholders = ", ".join(["%s"] * len(user_tokens))
            where_clauses.append(f"CAST(o.user_id AS CHAR) IN ({placeholders})")
            params.extend(user_tokens)
        else:
            return None

        where_sql = " AND ".join(where_clauses)
        cur.execute(
            f"""
            SELECT o.id, o.user_id, o.items, o.total, o.address, o.status, o.order_type, o.table_id,
                   o.payment_status, o.payment_method, o.created_at, o.updated_at, t.table_code
            FROM orders o
            LEFT JOIN restaurant_tables t ON o.table_id = t.id
            WHERE {where_sql}
            ORDER BY o.created_at DESC
            LIMIT 1
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": int(row[0]),
            "user_id": row[1],
            "items": _assistant_parse_order_items(row[2]),
            "total": float(row[3] or 0),
            "address": row[4],
            "status": row[5],
            "order_type": row[6],
            "table_id": row[7],
            "payment_status": row[8],
            "payment_method": row[9],
            "created_at": row[10].isoformat() if row[10] else None,
            "updated_at": row[11].isoformat() if row[11] else None,
            "table_code": row[12],
        }
    finally:
        cur.close()


def _assistant_fetch_live_bookings(user_tokens: list[str], limit: int = 3):
    if not user_tokens:
        return []
    placeholders = ", ".join(["%s"] * len(user_tokens))
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            f"""
            SELECT b.id, b.name, b.email, b.phone, b.date, b.time, b.guests, b.message,
                   b.table_id, b.status, b.created_at, t.table_code
            FROM bookings b
            LEFT JOIN restaurant_tables t ON b.table_id = t.id
            WHERE CAST(b.user_id AS CHAR) IN ({placeholders})
              AND b.status IN ('pending', 'confirmed')
              AND b.date >= CURDATE()
            ORDER BY b.date ASC, b.time ASC
            LIMIT %s
            """,
            user_tokens + [limit],
        )
        rows = cur.fetchall() or []
        return [
            {
                "id": int(row[0]),
                "name": row[1],
                "email": row[2],
                "phone": row[3],
                "date": row[4].isoformat() if row[4] else None,
                "time": str(row[5]) if row[5] else None,
                "guests": int(row[6] or 0),
                "message": row[7] or "",
                "table_id": row[8],
                "status": row[9],
                "created_at": row[10].isoformat() if row[10] else None,
                "table_code": row[11],
            }
            for row in rows
        ]
    finally:
        cur.close()


def _assistant_fetch_table_summary(guest_count: int | None = None):
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT
                SUM(status = 'available') AS available_count,
                SUM(status = 'reserved') AS reserved_count,
                SUM(status = 'occupied') AS occupied_count
            FROM restaurant_tables
            """
        )
        counts = cur.fetchone() or (0, 0, 0)
        params = []
        where = ""
        if guest_count:
            where = "WHERE seats >= %s"
            params.append(guest_count)
        cur.execute(
            f"""
            SELECT id, table_code, seats, status
            FROM restaurant_tables
            {where}
            ORDER BY status = 'available' DESC, seats ASC, table_code ASC
            LIMIT 5
            """,
            params,
        )
        tables = [
            {
                "id": int(row[0]),
                "table_code": row[1],
                "seats": int(row[2] or 0),
                "status": row[3],
            }
            for row in cur.fetchall() or []
        ]
        return {
            "available_count": int(counts[0] or 0),
            "reserved_count": int(counts[1] or 0),
            "occupied_count": int(counts[2] or 0),
            "recommended_tables": tables,
        }
    finally:
        cur.close()


def _assistant_build_menu_qr_payload():
    menu_url = f"{_resolve_qr_frontend_url()}/order-online?dine_in=1"
    return {
        "menu_url": menu_url,
        "qr_image": _build_qr_data_uri(menu_url),
    }


def _assistant_enrich_live_response(message: str, prediction, backend_order_id: int | None = None):
    raw_user_id = get_current_user()
    live_user = _assistant_resolve_live_user(raw_user_id)
    user_tokens = _assistant_user_tokens(live_user, raw_user_id)
    live_context = {"user": live_user}
    reply = prediction.reply
    suggestions = list(prediction.suggestions or [])

    explicit_order_id = _assistant_extract_numeric_order_id(message)
    guest_count = _assistant_extract_guest_count(message)

    if prediction.intent == "order_checkout" and backend_order_id is not None:
        live_order = _assistant_fetch_live_order(user_tokens, explicit_order_id=backend_order_id)
        if live_order:
            live_context["order"] = live_order
            reply = (
                f"{reply} It has been synced to the live restaurant database as order #{live_order['id']} "
                f"with status {live_order['status']}."
            )
            suggestions = [f"Track order #{live_order['id']}", "Show my latest reservation", "Show available tables"]
    elif prediction.intent == "order_status" or ASSISTANT_ORDER_PATTERN.search(message):
        live_order = _assistant_fetch_live_order(user_tokens, explicit_order_id=explicit_order_id)
        if live_order:
            item_names = []
            for item in live_order["items"]:
                if isinstance(item, dict):
                    qty = int(item.get("qty", 1) or 1)
                    item_names.append(f"{qty} x {item.get('name', 'Item')}")
                else:
                    item_names.append(str(item))
            item_summary = ", ".join(item_names) if item_names else "No item details available"
            reply = (
                f"Your live order #{live_order['id']} is currently {live_order['status']}. "
                f"Items: {item_summary}. Total: Rs. {live_order['total']:.2f}. "
                f"Payment: {live_order['payment_status']}."
            )
            if live_order.get("table_code"):
                reply += f" Table: {live_order['table_code']}."
            live_context["order"] = live_order
            suggestions = [f"Track order #{live_order['id']}", "What is my payment status?", "Show my latest reservation"]
        elif live_user:
            if explicit_order_id is not None:
                reply = (
                    f"I couldn't find live order #{explicit_order_id} for your account. "
                    "If you placed an order recently, ask me to show your latest order or your payment status."
                )
            else:
                reply = (
                    "I couldn't find a live order for your account right now. "
                    "Once you place an order through the app or chat assistant, I can track it here."
                )
            suggestions = ["Place my order", "Show available tables", "Show my latest reservation"]

    if prediction.intent == "reservation" or ASSISTANT_BOOKING_PATTERN.search(message):
        live_bookings = _assistant_fetch_live_bookings(user_tokens)
        table_summary = _assistant_fetch_table_summary(guest_count)
        live_context["bookings"] = live_bookings
        live_context["tables"] = table_summary
        if live_bookings:
            next_booking = live_bookings[0]
            reply = (
                f"Your next live reservation is booking #{next_booking['id']} on {next_booking['date']} at "
                f"{next_booking['time']} for {next_booking['guests']} guests with status {next_booking['status']}."
            )
            if next_booking.get("table_code"):
                reply += f" Assigned table: {next_booking['table_code']}."
        else:
            reply = (
                f"I couldn't find an active reservation for your account yet. "
                f"There are currently {table_summary['available_count']} available tables, "
                f"{table_summary['reserved_count']} reserved, and {table_summary['occupied_count']} occupied."
            )
            if guest_count and table_summary["recommended_tables"]:
                choices = ", ".join(
                    f"{table['table_code']} ({table['seats']} seats, {table['status']})"
                    for table in table_summary["recommended_tables"][:3]
                )
                reply += f" Best current matches for {guest_count} guests: {choices}."
        suggestions = ["Show available tables", "Show my latest reservation", "Book a table for 4"]

    if ASSISTANT_TABLE_PATTERN.search(message):
        table_summary = live_context.get("tables") or _assistant_fetch_table_summary(guest_count)
        live_context["tables"] = table_summary
        choices = ""
        if table_summary["recommended_tables"]:
            choices = " Best options: " + ", ".join(
                f"{table['table_code']} ({table['seats']} seats, {table['status']})"
                for table in table_summary["recommended_tables"][:3]
            ) + "."
        reply = (
            f"Live table status: {table_summary['available_count']} available, "
            f"{table_summary['reserved_count']} reserved, and {table_summary['occupied_count']} occupied."
            f"{choices}"
        )
        suggestions = ["Book a table for 2", "Book a table for 4", "Show my latest reservation"]

    if ASSISTANT_ACCOUNT_PATTERN.search(message):
        if live_user:
            reply = (
                f"Your live account profile shows {live_user['full_name']} ({live_user['email']}). "
                f"Role: {live_user['role']}. Status: {'active' if live_user['is_active'] else 'inactive'}."
            )
            if live_user.get("phone"):
                reply += f" Phone: {live_user['phone']}."
            if live_user.get("last_login_at"):
                reply += f" Last login: {live_user['last_login_at']}."
        else:
            reply = "Sign in to let me access your live account details, orders, reservations, and table context."
        suggestions = ["Show my latest order", "Show my latest reservation", "Show available tables"]

    if ASSISTANT_MENU_QR_PATTERN.search(message):
        live_context["menu_qr"] = _assistant_build_menu_qr_payload()
        reply = "Here is your menu QR. Scan it to open the dine-in menu quickly."
        suggestions = ["Place my order", "Show vegetarian dishes", "Book a table for 2"]

    final_suggestions = list(suggestions or prediction.suggestions or [])
    if not any(str(item).strip().lower() == "scan qr for menu" for item in final_suggestions):
        final_suggestions.append("scan QR for menu")

    return {
        "reply": reply,
        "suggestions": final_suggestions,
        "live_context": live_context,
    }


def _require_roles(*allowed_roles):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = _get_current_user_record()
            if not user:
                return json_response("Authentication required.", success=False, status=401)
            if not user.get("is_active", False):
                return json_response("Account is inactive.", success=False, status=403)
            if allowed_roles and user.get("role") not in allowed_roles:
                return json_response("Not authorized.", success=False, status=403)
            return func(*args, **kwargs)

        return wrapper

    return decorator


def _log_activity(user_id: str, action: str):
    if not user_id:
        return
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            INSERT INTO login_activity (user_id, action, ip_address, user_agent)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, action, request.remote_addr, request.headers.get("User-Agent", "")),
        )
        mysql.connection.commit()
    finally:
        cur.close()


def _is_missing_table_error(exc: Exception) -> bool:
    return getattr(exc, "args", [None])[0] == 1146


def _is_missing_column_error(exc: Exception) -> bool:
    return getattr(exc, "args", [None])[0] == 1054


def _column_exists(cur, table_name: str, column_name: str) -> bool:
    cur.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
    return cur.fetchone() is not None


def _ensure_users_auth_columns(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            user_id       VARCHAR(50)  UNIQUE NOT NULL,
            email         VARCHAR(100) UNIQUE NOT NULL,
            password      VARCHAR(255) NOT NULL DEFAULT '',
            google_id     VARCHAR(100) DEFAULT NULL,
            mfa_secret    VARCHAR(64)  DEFAULT NULL,
            mfa_enabled   TINYINT(1)   DEFAULT 0,
            full_name     VARCHAR(120) DEFAULT NULL,
            phone         VARCHAR(20)  DEFAULT NULL,
            role          ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer',
            is_active     TINYINT(1)   NOT NULL DEFAULT 1,
            last_login_at TIMESTAMP    NULL DEFAULT NULL,
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    user_column_fixes = [
        ("google_id", "ALTER TABLE users ADD COLUMN google_id VARCHAR(100) DEFAULT NULL"),
        ("mfa_secret", "ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64) DEFAULT NULL"),
        ("mfa_enabled", "ALTER TABLE users ADD COLUMN mfa_enabled TINYINT(1) DEFAULT 0"),
        ("full_name", "ALTER TABLE users ADD COLUMN full_name VARCHAR(120) DEFAULT NULL"),
        ("phone", "ALTER TABLE users ADD COLUMN phone VARCHAR(20) DEFAULT NULL"),
        (
            "role",
            "ALTER TABLE users ADD COLUMN role ENUM('customer','staff','admin') NOT NULL DEFAULT 'customer'",
        ),
        ("is_active", "ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1"),
        ("last_login_at", "ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL"),
        ("created_at", "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]

    for column_name, sql in user_column_fixes:
        if not _column_exists(cur, "users", column_name):
            cur.execute(sql)


def _ensure_email_otp_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS email_otps (
            token      VARCHAR(128) PRIMARY KEY,
            user_id    VARCHAR(50)  NOT NULL,
            email      VARCHAR(100) NOT NULL,
            code       VARCHAR(6)   NOT NULL,
            expires_at DATETIME     NOT NULL,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    email_otp_column_fixes = [
        ("token", "ALTER TABLE email_otps ADD COLUMN token VARCHAR(128) PRIMARY KEY"),
        ("user_id", "ALTER TABLE email_otps ADD COLUMN user_id VARCHAR(50) NOT NULL"),
        ("email", "ALTER TABLE email_otps ADD COLUMN email VARCHAR(100) NOT NULL"),
        ("code", "ALTER TABLE email_otps ADD COLUMN code VARCHAR(6) NOT NULL"),
        ("expires_at", "ALTER TABLE email_otps ADD COLUMN expires_at DATETIME NOT NULL"),
        ("created_at", "ALTER TABLE email_otps ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ]

    existing_columns = set()
    cur.execute("SHOW COLUMNS FROM email_otps")
    for row in cur.fetchall() or []:
        existing_columns.add(row[0])

    if "token" not in existing_columns:
        cur.execute("DROP TABLE IF EXISTS email_otps")
        cur.execute(
            """
            CREATE TABLE email_otps (
                token      VARCHAR(128) PRIMARY KEY,
                user_id    VARCHAR(50)  NOT NULL,
                email      VARCHAR(100) NOT NULL,
                code       VARCHAR(6)   NOT NULL,
                expires_at DATETIME     NOT NULL,
                created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        return

    for column_name, sql in email_otp_column_fixes:
        if column_name not in existing_columns:
            cur.execute(sql)


def _ensure_orders_schema(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id                  INT AUTO_INCREMENT PRIMARY KEY,
            user_id             INT DEFAULT NULL,
            items               TEXT NOT NULL,
            total               DECIMAL(10,2) NOT NULL,
            address             TEXT NOT NULL,
            status              VARCHAR(30) DEFAULT 'pending',
            kitchen_accepted_by VARCHAR(50) DEFAULT NULL,
            kitchen_accepted_at TIMESTAMP NULL DEFAULT NULL,
            order_type          ENUM('online','dine_in') NOT NULL DEFAULT 'online',
            table_id            INT DEFAULT NULL,
            payment_status      ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
            payment_method      VARCHAR(50) DEFAULT NULL,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
        """
    )

    order_column_fixes = [
        ("kitchen_accepted_by", "ALTER TABLE orders ADD COLUMN kitchen_accepted_by VARCHAR(50) DEFAULT NULL"),
        ("kitchen_accepted_at", "ALTER TABLE orders ADD COLUMN kitchen_accepted_at TIMESTAMP NULL DEFAULT NULL"),
        ("order_type", "ALTER TABLE orders ADD COLUMN order_type ENUM('online','dine_in') NOT NULL DEFAULT 'online'"),
        ("table_id", "ALTER TABLE orders ADD COLUMN table_id INT DEFAULT NULL"),
        ("payment_status", "ALTER TABLE orders ADD COLUMN payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid'"),
        ("payment_method", "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT NULL"),
        ("updated_at", "ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ]

    for column_name, sql in order_column_fixes:
        if not _column_exists(cur, "orders", column_name):
            cur.execute(sql)


def _ensure_login_activity_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS login_activity (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            user_id    VARCHAR(50) NOT NULL,
            action     VARCHAR(50) NOT NULL DEFAULT 'login',
            ip_address VARCHAR(45) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def _ensure_auth_schema() -> None:
    cur = mysql.connection.cursor()
    try:
        _ensure_users_auth_columns(cur)
        _ensure_email_otp_table(cur)
        _ensure_orders_schema(cur)
        _ensure_login_activity_table(cur)
        admin_user = os.environ.get("DEFAULT_ADMIN_USER", "admin").strip()
        admin_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@gtl.local").strip()
        admin_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123").strip()
        admin_name = os.environ.get("DEFAULT_ADMIN_FULL_NAME", "System Admin").strip()
        cur.execute("SELECT id FROM users WHERE user_id = %s", (admin_user,))
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO users (user_id, email, password, full_name, role, is_active)
                VALUES (%s, %s, %s, %s, 'admin', 1)
                """,
                (admin_user, admin_email, admin_password, admin_name),
            )
        mysql.connection.commit()
    finally:
        cur.close()


def _store_email_otp(user_id: str, email: str, code: str, token: str, expires_at: datetime) -> None:
    cur = mysql.connection.cursor()
    try:
        try:
            # Keep only the latest OTP for an email.
            cur.execute("DELETE FROM email_otps WHERE email = %s", (email,))
            cur.execute(
                """
                INSERT INTO email_otps (token, user_id, email, code, expires_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (token, user_id, email, code, expires_at),
            )
        except Exception as exc:
            if _is_missing_table_error(exc):
                _ensure_email_otp_table(cur)
                cur.execute("DELETE FROM email_otps WHERE email = %s", (email,))
                cur.execute(
                    """
                    INSERT INTO email_otps (token, user_id, email, code, expires_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (token, user_id, email, code, expires_at),
                )
            else:
                raise
        mysql.connection.commit()
    finally:
        cur.close()


def _fetch_email_otp(token: str):
    cur = mysql.connection.cursor()
    try:
        try:
            cur.execute(
                "SELECT user_id, email, code, expires_at FROM email_otps WHERE token = %s",
                (token,),
            )
        except Exception as exc:
            if _is_missing_table_error(exc):
                _ensure_email_otp_table(cur)
                return None
            raise
        return cur.fetchone()
    finally:
        cur.close()


def _fetch_latest_email_otp(email: str):
    cur = mysql.connection.cursor()
    try:
        try:
            cur.execute(
                """
                SELECT user_id, email, code, expires_at, token
                FROM email_otps
                WHERE email = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (email,),
            )
        except Exception as exc:
            if _is_missing_table_error(exc):
                _ensure_email_otp_table(cur)
                return None
            raise
        return cur.fetchone()
    finally:
        cur.close()


def _fetch_latest_otp_by_code(code: str):
    cur = mysql.connection.cursor()
    try:
        try:
            cur.execute(
                """
                SELECT user_id, email, code, expires_at, token
                FROM email_otps
                WHERE code = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (code,),
            )
        except Exception as exc:
            if _is_missing_table_error(exc):
                _ensure_email_otp_table(cur)
                return None
            raise
        return cur.fetchone()
    finally:
        cur.close()


def _delete_email_otp(token: str) -> None:
    cur = mysql.connection.cursor()
    try:
        cur.execute("DELETE FROM email_otps WHERE token = %s", (token,))
        mysql.connection.commit()
    finally:
        cur.close()


def _send_email_otp(recipient: str, code: str) -> None:
    """
    Send a 6-digit OTP to the given recipient.

    SMTP settings are taken from environment variables:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS (optional, default "1").

    If SMTP is not configured or sending fails, the OTP is logged so that
    development and testing can still proceed.
    """
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT", "587")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)
    use_tls = os.environ.get("SMTP_USE_TLS", "1") != "0"
    use_ssl = os.environ.get("SMTP_USE_SSL", "0") == "1"

    if not (smtp_host and smtp_port and smtp_user and smtp_password and smtp_from):
        # Fall back to logging the OTP for local development.
        app.logger.warning("SMTP not fully configured; OTP for %s is %s", recipient, code)
        return

    try:
        port = int(smtp_port)
        server = smtplib.SMTP_SSL(smtp_host, port) if use_ssl else smtplib.SMTP(smtp_host, port)
        server.ehlo()
        if use_tls and not use_ssl:
            server.starttls()
            server.ehlo()
        server.login(smtp_user, smtp_password)

        msg = EmailMessage()
        msg["Subject"] = "Your GTL Utsav Dining verification code"
        msg["From"] = smtp_from
        msg["To"] = recipient
        msg.set_content(
            f"Your GTL Utsav Dining verification code is {code}.\n\n"
            "Enter this 6-digit code in the app to complete sign-in. "
            "For your security, do not share this code with anyone."
        )

        server.send_message(msg)
    except Exception as exc:  # pragma: no cover - defensive logging
        app.logger.error("Failed to send OTP email to %s: %s", recipient, exc)
        app.logger.info("OTP code for %s is %s", recipient, code)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def issue_email_otp_for_user(user_id: str, email: str) -> dict:
    """
    Generate a random 6-digit OTP, send it via email,
    and store it server-side with a short expiry.
    """
    code = f"{random.randint(0, 999999):06d}"
    _send_email_otp(email, code)

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(seconds=OTP_TTL_SECONDS)
    _store_email_otp(user_id, email, code, token, expires_at)
    # Dev fallback: log the OTP so local testing isn't blocked by email delivery.
    app.logger.warning("DEV OTP for %s is %s (token=%s)", email, code, token)
    return {"otp_token": token, "expires_in": OTP_TTL_SECONDS}


with app.app_context():
    _ensure_auth_schema()


# -- Google OAuth Signal Handler ------------------------------------------------
if google_bp:
    # Fires automatically when Google redirects back to /google-login/authorized

    @oauth_authorized.connect_via(google_bp)
    def google_logged_in(blueprint, token):
        if not token:
            app.logger.error("Google login returned empty token")
            return False

        resp = blueprint.session.get("/oauth2/v2/userinfo")
        if not resp.ok:
            app.logger.error("Google login failed to fetch profile")
            return False

        info      = resp.json()
        email     = info.get("email")
        google_id = info.get("id")

        cur = mysql.connection.cursor()
        cur.execute("SELECT id, user_id, email FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if user:
            user_id = user[1]
        else:
            user_id = email.split("@")[0]
            try:
                cur.execute(
                    "INSERT INTO users (user_id, email, password, google_id) VALUES (%s, %s, %s, %s)",
                    (user_id, email, "", google_id)
                )
                mysql.connection.commit()
            except Exception as e:
                app.logger.error("Auto-registration failed: %s", e)
                cur.close()
                return redirect(f"{FRONTEND_URL}/login")

        # Always require OTP verification via email for Google sign-in.
        challenge = issue_email_otp_for_user(user_id, email)
        cur.close()
        return redirect(
            f"{FRONTEND_URL}/verify-mfa?token={challenge['otp_token']}&expires_in={challenge['expires_in']}&email={email}"
        )

# ── Routes ─────────────────────────────────────────────────────────────────

app.register_blueprint(
    create_admin_dashboard_blueprint(
        mysql=mysql,
        json_response=json_response,
        require_roles=_require_roles,
    )
)
app.register_blueprint(
    create_admin_menu_blueprint(
        mysql=mysql,
        json_response=json_response,
        require_roles=_require_roles,
        get_request_data=_get_request_data,
        parse_bool=_parse_bool,
        upload_dir=UPLOAD_DIR,
    )
)
app.register_blueprint(
    create_admin_table_blueprint(
        mysql=mysql,
        json_response=json_response,
        require_roles=_require_roles,
        get_request_data=_get_request_data,
        apply_date_range=_apply_date_range,
        parse_pagination=_parse_pagination,
    )
)
app.register_blueprint(
    create_admin_order_blueprint(
        mysql=mysql,
        json_response=json_response,
        require_roles=_require_roles,
        get_request_data=_get_request_data,
        get_current_user=get_current_user,
        apply_date_range=_apply_date_range,
        parse_pagination=_parse_pagination,
    )
)


@app.route("/")
def welcome():
    return json_response(
        "Flask API is running. Point a browser to the React frontend.",
        data={"frontend": FRONTEND_URL},
    )


@app.route("/home")
def home():
    return json_response("Home data", data={"user": get_current_user()})


@app.route("/about")
def about():
    return json_response("About GTL Utsav Dining")


@app.route("/contact", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        return json_response("Message sent successfully! We'll get back to you soon.")
    return json_response("Submit a POST to /contact to reach GTL support.")


@app.route("/events")
def events():
    return json_response("Events list is maintained inside the React frontend.")


@app.route("/book-table", methods=["GET", "POST"])
def book_table():
    if request.method == "POST":
        payload = _get_request_data()

        raw_uid = get_current_user() or payload.get("user_id")
        user_id = str(raw_uid).strip() if raw_uid is not None and str(raw_uid).strip() else None
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        date = str(payload.get("date", "")).strip()
        time = _parse_time(payload.get("time"))
        guests = payload.get("guests", 2)
        message = str(payload.get("message", "")).strip()
        table_id = payload.get("table_id")
        status = str(payload.get("status", "pending")).strip() or "pending"

        if not all([user_id, name, email, phone, date, time]):
            return json_response("Required fields missing or invalid.", success=False, status=400)

        cur = mysql.connection.cursor()

        try:
            # 🔥 Detect available columns dynamically
            cur.execute("SHOW COLUMNS FROM bookings")
            existing_columns = {row[0] for row in cur.fetchall()}

            # Base fields
            columns = ["user_id", "name", "email", "phone", "date", "time", "guests", "message"]
            values = [user_id, name, email, phone, date, time, guests, message]

            # Optional fields
            if "table_id" in existing_columns and table_id:
                columns.append("table_id")
                values.append(int(table_id))

            if "status" in existing_columns:
                columns.append("status")
                values.append(status)

            # 🔥 Build dynamic query
            placeholders = ", ".join(["%s"] * len(columns))
            columns_sql = ", ".join(columns)

            query = f"INSERT INTO bookings ({columns_sql}) VALUES ({placeholders})"

            cur.execute(query, tuple(values))

            mysql.connection.commit()

            return json_response(
                "Table booked successfully!",
                data={"id": cur.lastrowid}
            )

        except Exception as e:
            app.logger.error("Booking failed: %s", e)
            return json_response(f"Booking failed: {e}", success=False, status=500)

        finally:
            cur.close()

    return json_response("Submit a POST to /book-table with reservation data.")


@app.route("/order-online")
def order_online():
    return json_response("Order online view is handled through the React frontend.")


@app.route("/menu-qr")
def menu_qr():
    menu_url = f"{_resolve_qr_frontend_url()}/order-online?dine_in=1"
    return json_response(
        "Menu QR generated.",
        data={
            "menu_url": menu_url,
            "qr_image": _build_qr_data_uri(menu_url),
        },
    )



# ── /menu alias (public) ─────────────────────────────────────────────────
@app.route("/menu", methods=["GET"])
def public_menu_alias():
    """Public alias for /menu-items so the frontend can use either endpoint."""
    category  = request.args.get("category")
    available = request.args.get("available")
    clauses, params = [], []
    if category:
        clauses.append("category = %s")
        params.append(category)
    if available is not None:
        clauses.append("is_available = %s")
        params.append(1 if str(available).lower() in ("1", "true", "yes") else 0)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            f"""
            SELECT id, name, description, price, category, image_url, is_available, is_veg, is_spicy
            FROM menu_items
            {where}
            ORDER BY category, name
            """,
            params,
        )
        rows = cur.fetchall() or []
        items = [
            {"id": r[0], "name": r[1], "description": r[2], "price": float(r[3] or 0),
             "category": r[4], "image_url": r[5], "is_available": bool(r[6]),
             "is_veg": bool(r[7]), "is_spicy": bool(r[8])}
            for r in rows
        ]
        return json_response("Menu items fetched.", data=items)
    except Exception as exc:
        app.logger.error("public_menu_alias error: %s", exc)
        return json_response(str(exc), success=False, status=500)
    finally:
        cur.close()


# ── Menu (Public + Admin) ─────────────────────────────────────────────────

@app.route("/admin/session")
@_require_roles("admin", "staff")
def admin_session():
    user = _get_current_user_record()
    return json_response("Admin session", data=user)


# ── Tables + Bookings ─────────────────────────────────────────────────────


@app.route("/admin/inventory", methods=["GET", "POST"])
@_require_roles("admin", "staff")
def admin_inventory():
    if request.method == "POST":
        payload = _get_request_data()
        name = str(payload.get("name", "")).strip()
        unit = str(payload.get("unit", "pcs")).strip() or "pcs"
        stock_qty = float(payload.get("stock_qty", 0) or 0)
        reorder_level = float(payload.get("reorder_level", 0) or 0)
        if not name:
            return json_response("Name is required.", success=False, status=400)
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                """
                INSERT INTO inventory_items (name, unit, stock_qty, reorder_level)
                VALUES (%s, %s, %s, %s)
                """,
                (name, unit, stock_qty, reorder_level),
            )
            mysql.connection.commit()
            return json_response("Inventory item created.", data={"id": cur.lastrowid})
        except Exception as exc:
            app.logger.error("Inventory create failed: %s", exc)
            return json_response("Unable to create inventory item.", success=False, status=500)
        finally:
            cur.close()

    cur = mysql.connection.cursor()
    try:
        query = request.args.get("q")
        low_stock = request.args.get("low_stock")
        clauses = []
        params = []
        if query:
            like = f"%{query.strip()}%"
            clauses.append("name LIKE %s")
            params.append(like)
        if low_stock is not None:
            if _parse_bool(low_stock, True):
                clauses.append("stock_qty <= reorder_level")
            else:
                clauses.append("stock_qty > reorder_level")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        page, page_size, offset = _parse_pagination()
        cur.execute(f"SELECT COUNT(*) FROM inventory_items {where}", params)
        total = int((cur.fetchone() or (0,))[0] or 0)
        cur.execute(
            f"""
            SELECT id, name, unit, stock_qty, reorder_level, updated_at
            FROM inventory_items
            {where}
            ORDER BY name
            LIMIT %s OFFSET %s
            """,
            params + [page_size, offset],
        )
        items = [
            {
                "id": row[0],
                "name": row[1],
                "unit": row[2],
                "stock_qty": float(row[3] or 0),
                "reorder_level": float(row[4] or 0),
                "updated_at": row[5].isoformat() if row[5] else None,
            }
            for row in cur.fetchall() or []
        ]
        meta = {
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_more": offset + page_size < total,
        }
        return json_response("Inventory items", data=items, meta=meta)
    except Exception as exc:
        app.logger.error("Inventory fetch failed: %s", exc)
        return json_response("Unable to load inventory.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/inventory/<int:item_id>", methods=["PUT", "PATCH"])
@_require_roles("admin", "staff")
def admin_update_inventory(item_id):
    payload = _get_request_data()
    fields = []
    params = []
    for key, column in [
        ("name", "name"),
        ("unit", "unit"),
        ("stock_qty", "stock_qty"),
        ("reorder_level", "reorder_level"),
    ]:
        if key in payload:
            fields.append(f"{column} = %s")
            params.append(payload.get(key))
    if not fields:
        return json_response("Nothing to update.", success=False, status=400)
    params.append(item_id)
    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM inventory_items WHERE id = %s", (item_id,))
        if not cur.fetchone():
            return json_response("Inventory item not found.", success=False, status=404)
        cur.execute(f"UPDATE inventory_items SET {', '.join(fields)} WHERE id = %s", params)
        mysql.connection.commit()
        return json_response("Inventory updated.")
    except Exception as exc:
        app.logger.error("Inventory update failed: %s", exc)
        return json_response("Unable to update inventory.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/inventory/<int:item_id>", methods=["DELETE"])
@_require_roles("admin", "staff")
def admin_delete_inventory(item_id):
    cur = mysql.connection.cursor()
    try:
        cur.execute("DELETE FROM inventory_items WHERE id = %s", (item_id,))
        if not cur.rowcount:
            mysql.connection.rollback()
            return json_response("Inventory item not found.", success=False, status=404)
        mysql.connection.commit()
        return json_response("Inventory deleted.")
    except Exception as exc:
        app.logger.error("Inventory delete failed: %s", exc)
        return json_response("Unable to delete inventory.", success=False, status=500)
    finally:
        cur.close()


# ── Reports ───────────────────────────────────────────────────────────────

@app.route("/admin/reports/summary")
@_require_roles("admin", "staff")
def admin_reports_summary():
    cur = mysql.connection.cursor()
    try:
        start_date = _parse_date(request.args.get("start_date"))
        end_date = _parse_date(request.args.get("end_date"))
        if start_date or end_date:
            clauses = []
            params = []
            _apply_date_range(clauses, params, column="created_at")
            where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            cur.execute(
                f"SELECT COALESCE(SUM(total), 0) FROM orders {where}",
                params,
            )
            range_sales = float((cur.fetchone() or (0,))[0] or 0)
            cur.execute(
                f"SELECT COUNT(*) FROM orders {where}",
                params,
            )
            range_orders = int((cur.fetchone() or (0,))[0] or 0)
            cur.execute(
                f"""
                SELECT item_name, SUM(qty) AS qty
                FROM order_items
                WHERE order_id IN (SELECT id FROM orders {where})
                GROUP BY item_name
                ORDER BY qty DESC
                LIMIT 1
                """,
                params,
            )
            top_row = cur.fetchone()
            top_item = {"name": None, "qty": 0}
            if top_row:
                top_item = {"name": top_row[0], "qty": int(top_row[1] or 0)}
            return json_response(
                "Reports summary",
                data={
                    "daily_sales": range_sales,
                    "weekly_sales": range_sales,
                    "total_orders": range_orders,
                    "top_item": top_item,
                    "range": {
                        "start_date": start_date.isoformat() if start_date else None,
                        "end_date": end_date.isoformat() if end_date else None,
                    },
                },
            )

        cur.execute(
            "SELECT COALESCE(SUM(total), 0) FROM orders WHERE DATE(created_at) = CURDATE()"
        )
        daily_sales = float((cur.fetchone() or (0,))[0] or 0)

        cur.execute(
            """
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()
            """
        )
        weekly_sales = float((cur.fetchone() or (0,))[0] or 0)

        cur.execute("SELECT COUNT(*) FROM orders")
        total_orders = int((cur.fetchone() or (0,))[0] or 0)

        cur.execute(
            """
            SELECT item_name, SUM(qty) AS qty
            FROM order_items
            GROUP BY item_name
            ORDER BY qty DESC
            LIMIT 1
            """
        )
        top_row = cur.fetchone()
        top_item = {"name": None, "qty": 0}
        if top_row:
            top_item = {"name": top_row[0], "qty": int(top_row[1] or 0)}

        return json_response(
            "Reports summary",
            data={
                "daily_sales": daily_sales,
                "weekly_sales": weekly_sales,
                "total_orders": total_orders,
                "top_item": top_item,
            },
        )
    except Exception as exc:
        app.logger.error("Reports summary failed: %s", exc)
        return json_response("Unable to load reports.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/reports/analytics")
@_require_roles("admin", "staff")
def admin_reports_analytics():
    days = int(request.args.get("days", 14) or 14)
    if days < 1:
        days = 14
    days = min(days, 90)
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT DATE(created_at) AS day, COALESCE(SUM(total), 0) AS total
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY DATE(created_at)
            ORDER BY day
            """,
            (days - 1,),
        )
        daily_sales = [
            {"date": row[0].isoformat(), "total": float(row[1] or 0)}
            for row in cur.fetchall() or []
        ]

        cur.execute(
            """
            SELECT status, COUNT(*)
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY status
            """,
            (days - 1,),
        )
        status_breakdown = [
            {"status": row[0], "count": int(row[1] or 0)}
            for row in cur.fetchall() or []
        ]

        cur.execute(
            """
            SELECT payment_status, COUNT(*), COALESCE(SUM(total), 0)
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY payment_status
            """,
            (days - 1,),
        )
        payment_breakdown = [
            {"status": row[0], "count": int(row[1] or 0), "total": float(row[2] or 0)}
            for row in cur.fetchall() or []
        ]

        cur.execute(
            """
            SELECT order_type, COUNT(*)
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY order_type
            """,
            (days - 1,),
        )
        order_type_share = [
            {"order_type": row[0], "count": int(row[1] or 0)}
            for row in cur.fetchall() or []
        ]

        cur.execute(
            """
            SELECT item_name, SUM(qty) AS qty
            FROM order_items
            WHERE order_id IN (
                SELECT id FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            )
            GROUP BY item_name
            ORDER BY qty DESC
            LIMIT 5
            """,
            (days - 1,),
        )
        top_items = [
            {"name": row[0], "qty": int(row[1] or 0)}
            for row in cur.fetchall() or []
        ]

        cur.execute(
            """
            SELECT COALESCE(SUM(total), 0), COUNT(*)
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            """,
            (days - 1,),
        )
        total_sales, total_orders = cur.fetchone() or (0, 0)
        avg_order_value = float(total_sales or 0) / max(int(total_orders or 0), 1)

        return json_response(
            "Reports analytics",
            data={
                "window_days": days,
                "daily_sales": daily_sales,
                "status_breakdown": status_breakdown,
                "payment_breakdown": payment_breakdown,
                "order_type_share": order_type_share,
                "top_items": top_items,
                "avg_order_value": round(avg_order_value, 2),
            },
        )
    except Exception as exc:
        app.logger.error("Reports analytics failed: %s", exc)
        return json_response("Unable to load analytics.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/reports/export/orders.csv")
@_require_roles("admin", "staff")
def admin_export_orders_csv():
    order_type = request.args.get("type")
    status = request.args.get("status")
    payment_status = request.args.get("payment_status")
    query = request.args.get("q")
    limit = int(request.args.get("limit", 2000) or 2000)
    limit = min(max(limit, 1), 10000)
    clauses = []
    params = []
    if order_type:
        clauses.append("order_type = %s")
        params.append(order_type)
    if status:
        clauses.append("status = %s")
        params.append(status)
    if payment_status:
        clauses.append("payment_status = %s")
        params.append(payment_status)
    _apply_date_range(clauses, params, column="created_at")
    if query:
        like = f"%{query.strip()}%"
        clauses.append("(user_id LIKE %s OR CAST(id AS CHAR) LIKE %s)")
        params.extend([like, like])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            f"""
            SELECT id, user_id, total, status, order_type, payment_status, payment_method, created_at
            FROM orders
            {where}
            ORDER BY created_at DESC
            LIMIT %s
            """,
            params + [limit],
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "user_id",
                "total",
                "status",
                "order_type",
                "payment_status",
                "payment_method",
                "created_at",
            ]
        )
        for row in cur.fetchall() or []:
            writer.writerow(
                [
                    row[0],
                    row[1],
                    float(row[2] or 0),
                    row[3],
                    row[4],
                    row[5],
                    row[6] or "",
                    row[7].isoformat() if row[7] else "",
                ]
            )
        response = make_response(output.getvalue())
        response.headers["Content-Type"] = "text/csv"
        response.headers["Content-Disposition"] = "attachment; filename=orders_export.csv"
        return response
    except Exception as exc:
        app.logger.error("Order export failed: %s", exc)
        return json_response("Unable to export orders.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/reports/export/revenue.csv")
@_require_roles("admin", "staff")
def admin_export_revenue_csv():
    days = int(request.args.get("days", 30) or 30)
    if days < 1:
        days = 30
    days = min(days, 180)
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT DATE(created_at) AS day, COALESCE(SUM(total), 0) AS total
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY DATE(created_at)
            ORDER BY day
            """,
            (days - 1,),
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["date", "total"])
        for row in cur.fetchall() or []:
            writer.writerow([row[0].isoformat(), float(row[1] or 0)])
        response = make_response(output.getvalue())
        response.headers["Content-Type"] = "text/csv"
        response.headers["Content-Disposition"] = "attachment; filename=revenue_export.csv"
        return response
    except Exception as exc:
        app.logger.error("Revenue export failed: %s", exc)
        return json_response("Unable to export revenue.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/reports/export/users.csv")
@_require_roles("admin")
def admin_export_users_csv():
    """Export users/staff data to CSV with optional filtering by role"""
    role = request.args.get("role")
    status = request.args.get("status")
    query = request.args.get("q")
    limit = int(request.args.get("limit", 10000) or 10000)
    limit = min(max(limit, 1), 50000)
    
    clauses = []
    params = []
    
    if role:
        clauses.append("role = %s")
        params.append(role)
    
    if status:
        if status.lower() == "active":
            clauses.append("is_active = 1")
        elif status.lower() == "inactive":
            clauses.append("is_active = 0")
    
    if query:
        like = f"%{query.strip()}%"
        clauses.append("(user_id LIKE %s OR email LIKE %s OR full_name LIKE %s)")
        params.extend([like, like, like])
    
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            f"""
            SELECT id, user_id, email, full_name, phone, role, is_active, last_login_at, created_at
            FROM users
            {where}
            ORDER BY role, created_at DESC
            LIMIT %s
            """,
            params + [limit],
        )
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id",
                "user_id",
                "email",
                "full_name",
                "phone",
                "role",
                "status",
                "last_login_at",
                "created_at",
            ]
        )
        
        for row in cur.fetchall() or []:
            writer.writerow(
                [
                    row[0],
                    row[1],
                    row[2],
                    row[3] or "N/A",
                    row[4] or "N/A",
                    row[5],
                    "Active" if row[6] else "Inactive",
                    row[7].isoformat() if row[7] else "Never",
                    row[8].isoformat() if row[8] else "",
                ]
            )
        
        response = make_response(output.getvalue())
        response.headers["Content-Type"] = "text/csv; charset=utf-8"
        response.headers["Content-Disposition"] = "attachment; filename=users_export.csv"
        return response
    except Exception as exc:
        app.logger.error("User export failed: %s", exc)
        return json_response("Unable to export users.", success=False, status=500)
    finally:
        cur.close()


# ── Users / Staff Management ──────────────────────────────────────────────

@app.route("/admin/users")
@_require_roles("admin")
def admin_users():
    role = request.args.get("role")
    status = request.args.get("status")
    query = request.args.get("q")
    clauses = []
    params = []
    if role:
        clauses.append("role = %s")
        params.append(role)
    if status:
        if status.lower() == "active":
            clauses.append("is_active = 1")
        elif status.lower() == "blocked":
            clauses.append("is_active = 0")
    if query:
        like = f"%{query.strip()}%"
        clauses.append("(user_id LIKE %s OR email LIKE %s OR full_name LIKE %s)")
        params.extend([like, like, like])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    page, page_size, offset = _parse_pagination()
    cur = mysql.connection.cursor()
    try:
        cur.execute(f"SELECT COUNT(*) FROM users {where}", params)
        total = int((cur.fetchone() or (0,))[0] or 0)
        cur.execute(
            f"""
            SELECT id, user_id, email, full_name, phone, role, is_active, last_login_at, created_at
            FROM users
            {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """,
            params + [page_size, offset],
        )
        users = [
            {
                "id": row[0],
                "user_id": row[1],
                "email": row[2],
                "full_name": row[3],
                "phone": row[4],
                "role": row[5],
                "is_active": bool(row[6]),
                "last_login_at": row[7].isoformat() if row[7] else None,
                "created_at": row[8].isoformat() if row[8] else None,
            }
            for row in cur.fetchall() or []
        ]
        meta = {
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_more": offset + page_size < total,
        }
        return json_response("Users", data=users, meta=meta)
    except Exception as exc:
        app.logger.error("Users fetch failed: %s", exc)
        return json_response("Unable to load users.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/users/<int:user_id>/status", methods=["PUT", "PATCH"])
@_require_roles("admin")
def admin_user_status(user_id):
    payload = _get_request_data()
    is_active = 1 if _parse_bool(payload.get("is_active", True), True) else 0
    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return json_response("User not found.", success=False, status=404)
        cur.execute("UPDATE users SET is_active = %s WHERE id = %s", (is_active, user_id))
        mysql.connection.commit()
        return json_response("User status updated.")
    except Exception as exc:
        app.logger.error("User status update failed: %s", exc)
        return json_response("Unable to update user.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/users/<int:user_id>/role", methods=["PUT", "PATCH"])
@_require_roles("admin")
def admin_user_role(user_id):
    payload = _get_request_data()
    role = str(payload.get("role", "")).strip()
    if role not in {"customer", "staff", "admin"}:
        return json_response("Invalid role.", success=False, status=400)
    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return json_response("User not found.", success=False, status=404)
        cur.execute("UPDATE users SET role = %s WHERE id = %s", (role, user_id))
        mysql.connection.commit()
        return json_response("User role updated.")
    except Exception as exc:
        app.logger.error("User role update failed: %s", exc)
        return json_response("Unable to update user role.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/users/login-activity")
@_require_roles("admin")
def admin_login_activity():
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT id, user_id, action, ip_address, user_agent, created_at
            FROM login_activity
            ORDER BY created_at DESC
            LIMIT 200
            """
        )
        items = [
            {
                "id": row[0],
                "user_id": row[1],
                "action": row[2],
                "ip_address": row[3],
                "user_agent": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
            }
            for row in cur.fetchall() or []
        ]
        return json_response("Login activity", data=items)
    except Exception as exc:
        app.logger.error("Login activity fetch failed: %s", exc)
        return json_response("Unable to load activity.", success=False, status=500)
    finally:
        cur.close()


# ── Feedback ──────────────────────────────────────────────────────────────

@app.route("/feedback", methods=["POST"])
def submit_feedback():
    payload = _get_request_data()
    user_id = payload.get("user_id") or get_current_user() or None
    rating = int(payload.get("rating", 0) or 0)
    comment = str(payload.get("comment", "")).strip()
    if rating < 1 or rating > 5:
        return json_response("Rating must be between 1 and 5.", success=False, status=400)
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "INSERT INTO feedback (user_id, rating, comment) VALUES (%s, %s, %s)",
            (user_id, rating, comment),
        )
        mysql.connection.commit()
        return json_response("Feedback submitted.")
    except Exception as exc:
        app.logger.error("Feedback submit failed: %s", exc)
        return json_response("Unable to submit feedback.", success=False, status=500)
    finally:
        cur.close()


@app.route("/admin/feedback")
@_require_roles("admin")
def admin_feedback():
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "SELECT id, user_id, rating, comment, created_at FROM feedback ORDER BY created_at DESC"
        )
        items = [
            {
                "id": row[0],
                "user_id": row[1],
                "rating": int(row[2] or 0),
                "comment": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
            }
            for row in cur.fetchall() or []
        ]
        return json_response("Feedback", data=items)
    except Exception as exc:
        app.logger.error("Feedback fetch failed: %s", exc)
        return json_response("Unable to load feedback.", success=False, status=500)
    finally:
        cur.close()


# ── User Profile ──────────────────────────────────────────────────────────

@app.route("/profile", methods=["GET", "PUT", "PATCH"])
def profile():
    user_id = get_current_user() or request.args.get("user_id")
    if not user_id:
        return json_response("Missing user.", success=False, status=400)
    cur = mysql.connection.cursor()
    if request.method in {"PUT", "PATCH"}:
        payload = _get_request_data()
        fields = []
        params = []
        for key, column in [
            ("full_name", "full_name"),
            ("phone", "phone"),
            ("email", "email"),
            ("password", "password"),
        ]:
            if key in payload and payload.get(key):
                fields.append(f"{column} = %s")
                params.append(payload.get(key))
        if not fields:
            return json_response("Nothing to update.", success=False, status=400)
        params.append(user_id)
        try:
            cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE user_id = %s", params)
            mysql.connection.commit()
            return json_response("Profile updated.")
        except Exception as exc:
            app.logger.error("Profile update failed: %s", exc)
            return json_response("Unable to update profile.", success=False, status=500)
        finally:
            cur.close()

    try:
        cur.execute(
            """
            SELECT user_id, email, full_name, phone, role, is_active, last_login_at, created_at
            FROM users
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
        if not row:
            return json_response("User not found.", success=False, status=404)
        return json_response(
            "Profile",
            data={
                "user_id": row[0],
                "email": row[1],
                "full_name": row[2],
                "phone": row[3],
                "role": row[4],
                "is_active": bool(row[5]),
                "last_login_at": row[6].isoformat() if row[6] else None,
                "created_at": row[7].isoformat() if row[7] else None,
            },
        )
    except Exception as exc:
        app.logger.error("Profile fetch failed: %s", exc)
        return json_response("Unable to load profile.", success=False, status=500)
    finally:
        cur.close()


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user_id = request.form.get("user_id", "").strip()
        password = request.form.get("password", "").strip()
        cur = mysql.connection.cursor()
        try:
            allow_direct_admin_login = os.environ.get("ALLOW_DIRECT_ADMIN_LOGIN", "1") != "0"
            default_admin_user = os.environ.get("DEFAULT_ADMIN_USER", "admin").strip()
            default_admin_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@gtl.local").strip()
            default_admin_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123").strip()
            default_admin_name = os.environ.get("DEFAULT_ADMIN_FULL_NAME", "System Admin").strip()

            # Always allow the configured default admin credentials to open a real
            # admin session without OTP, even if an older DB row has drifted.
            if allow_direct_admin_login and user_id == default_admin_user and password == default_admin_password:
                cur.execute(
                    "SELECT user_id, email, full_name, role, is_active FROM users WHERE user_id = %s",
                    (default_admin_user,),
                )
                admin_user = cur.fetchone()
                if admin_user:
                    record_user_id, email, full_name, role, is_active = admin_user
                    if role != "admin" or not bool(is_active) or password != default_admin_password:
                        cur.execute(
                            """
                            UPDATE users
                            SET email = %s, password = %s, full_name = %s, role = 'admin', is_active = 1
                            WHERE user_id = %s
                            """,
                            (default_admin_email, default_admin_password, default_admin_name, default_admin_user),
                        )
                        mysql.connection.commit()
                    email = default_admin_email
                    full_name = default_admin_name
                else:
                    cur.execute(
                        """
                        INSERT INTO users (user_id, email, password, full_name, role, is_active)
                        VALUES (%s, %s, %s, %s, 'admin', 1)
                        """,
                        (default_admin_user, default_admin_email, default_admin_password, default_admin_name),
                    )
                    mysql.connection.commit()
                    record_user_id = default_admin_user
                    email = default_admin_email
                    full_name = default_admin_name

                session["user_id"] = default_admin_user
                session["role"] = "admin"
                cur.execute("UPDATE users SET last_login_at = NOW() WHERE user_id = %s", (default_admin_user,))
                mysql.connection.commit()
                _log_activity(default_admin_user, "login")
                return json_response(
                    "Logged in.",
                    data={
                        "user": {
                            "user_id": default_admin_user,
                            "email": email,
                            "full_name": full_name,
                            "role": "admin",
                            "is_active": True,
                        }
                    },
                )

            cur.execute(
                """
                SELECT user_id, email, full_name, role, is_active
                FROM users
                WHERE user_id = %s AND password = %s
                """,
                (user_id, password),
            )
            user = cur.fetchone()

            if user:
                record_user_id, email, full_name, role, is_active = user
                if not is_active:
                    return json_response("Account is inactive. Contact support.", success=False, status=403)
                if allow_direct_admin_login and role in {"admin", "staff"}:
                    session["user_id"] = record_user_id
                    session["role"] = role
                    cur.execute("UPDATE users SET last_login_at = NOW() WHERE user_id = %s", (record_user_id,))
                    mysql.connection.commit()
                    _log_activity(record_user_id, "login")
                    return json_response(
                        "Logged in.",
                        data={
                            "user": {
                                "user_id": record_user_id,
                                "email": email,
                                "full_name": full_name,
                                "role": role,
                                "is_active": bool(is_active),
                            }
                        },
                    )
                if not email:
                    return json_response(
                        "Email not configured for this account. Cannot send OTP.",
                        success=False,
                        status=500,
                    )

                challenge = issue_email_otp_for_user(record_user_id, email)
                return json_response(
                    "OTP sent to your email. Please verify to complete login.",
                    data={
                        "mfa_required": True,
                        "otp_token": challenge["otp_token"],
                        "expires_in": challenge["expires_in"],
                        "email": email,
                    },
                )

            return json_response("Invalid credentials. Please try again.", success=False, status=401)
        except Exception as exc:
            app.logger.error("Login failed for user %s: %s", user_id, exc)
            return json_response(
                "Login failed on the server. Check the backend logs and database schema.",
                success=False,
                status=500,
            )
        finally:
            cur.close()

    return json_response(
        "POST to this endpoint with credentials.",
        data={
            "google_login_url": app.config.get("GOOGLE_LOGIN_URL"),
            "google_auth_enabled": app.config.get("GOOGLE_AUTH_ENABLED", False),
        },
    )


@app.route("/register", methods=["POST"])
def register():
    user_id  = request.form.get("user_id",  "").strip()
    email    = request.form.get("email",    "").strip()
    password = request.form.get("password", "").strip()

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "INSERT INTO users (user_id, email, password) VALUES (%s, %s, %s)",
            (user_id, email, password),
        )
        mysql.connection.commit()
        # After registration, send an email OTP and require verification
        # before treating the user as fully logged in.
        challenge = issue_email_otp_for_user(user_id, email)
        return json_response(
            "Registered successfully! Please verify the OTP sent to your email.",
            data={
                "mfa_required": True,
                "otp_token": challenge["otp_token"],
                "expires_in": challenge["expires_in"],
                "email": email,
            },
        )
    except Exception as exc:
        app.logger.error("Registration failed for user %s: %s", user_id, exc)
        return json_response(
            "Registration failed on the server. Check the backend logs and database schema.",
            success=False,
            status=500,
        )
    finally:
        cur.close()


# ── MFA Routes ─────────────────────────────────────────────────────────────

@app.route("/setup-mfa")
def setup_mfa():
    user_id = get_current_user()
    if not user_id:
        return redirect("/login")

    cur = mysql.connection.cursor()
    cur.execute("SELECT email, mfa_secret FROM users WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    cur.close()

    if not row:
        return json_response("User not found.", success=False, status=404)

    email, mfa_secret = row

    if not mfa_secret:
        mfa_secret = pyotp.random_base32()
        cur = mysql.connection.cursor()
        cur.execute("UPDATE users SET mfa_secret = %s WHERE user_id = %s", (mfa_secret, user_id))
        mysql.connection.commit()
        cur.close()

    totp_uri = pyotp.totp.TOTP(mfa_secret, interval=60).provisioning_uri(
        name=email, issuer_name="GTL Utsav Dining"
    )

    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_code = base64.b64encode(buf.getvalue()).decode()

    return json_response(
        "Scan this QR code using your authenticator app.",
        data={"qr_code": qr_code, "mfa_secret": mfa_secret},
    )


@app.route("/activate-mfa")
def activate_mfa():
    user_id = get_current_user()
    if not user_id:
        return redirect("/login")
    cur = mysql.connection.cursor()
    cur.execute("UPDATE users SET mfa_enabled = 1 WHERE user_id = %s", (user_id,))
    mysql.connection.commit()
    cur.close()
    return json_response("MFA activated successfully! Your account is now secured.")


@app.route("/verify-mfa", methods=["GET", "POST"])
def verify_mfa():
    if request.method == "POST":
        otp = request.form.get("otp", "").strip()
        otp_token = request.form.get("otp_token", "").strip()

        if not otp_token:
            return json_response("Missing OTP token. Please restart login.", success=False, status=400)
        if not otp or len(otp) != 6 or not otp.isdigit():
            return json_response("Invalid or expired code. Please try again.", success=False, status=400)

        record = _fetch_email_otp(otp_token) if otp_token else None
        email_from_request = request.form.get("email", "").strip()
        if not record and email_from_request:
            record = _fetch_latest_email_otp(email_from_request)
        if not record:
            record = _fetch_latest_otp_by_code(otp)
        if not record:
            return json_response("Invalid or expired code. Please try again.", success=False, status=400)

        if len(record) == 4:
            user_id, email, code, expires_at = record
            record_token = otp_token
        else:
            user_id, email, code, expires_at, record_token = record

        if datetime.utcnow() > expires_at:
            if record_token:
                _delete_email_otp(record_token)
            return json_response("Invalid or expired code. Please try again.", success=False, status=400)

        if otp != str(code):
            return json_response("Invalid or expired code. Please try again.", success=False, status=400)

        # Success: clear the OTP and log in the user in a session.
        if record_token:
            _delete_email_otp(record_token)
        session["user_id"] = user_id
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                "SELECT role, is_active FROM users WHERE user_id = %s",
                (user_id,),
            )
            user_row = cur.fetchone()
            if user_row and not bool(user_row[1]):
                return json_response("Account is inactive. Contact support.", success=False, status=403)
            session["role"] = user_row[0] if user_row else None
            cur.execute("UPDATE users SET last_login_at = NOW() WHERE user_id = %s", (user_id,))
            mysql.connection.commit()
        finally:
            cur.close()
        _log_activity(user_id, "login")
        return json_response(
            "MFA verified. Logged in.",
            data={
                "user": {
                    "user_id": user_id,
                    "email": email,
                    "role": user_row[0] if user_row else None,
                    "is_active": bool(user_row[1]) if user_row else True,
                }
            },
        )

    return json_response("Post otp + otp_token to this endpoint.")


@app.route("/api/assistant/chat", methods=["POST"])
def assistant_chat():
    if assistant_service is None:
        return _assistant_unavailable_response()

    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip()
    session_id = str(payload.get("sessionId", "")).strip() or None

    if not message:
        return json_response("Please enter a message.", success=False, status=400)

    try:
        prediction = assistant_service.predict(
            message,
            session_id=session_id,
            user_id=get_current_user(),
        )
    except ValueError as exc:
        return json_response(str(exc), success=False, status=400)
    except Exception as exc:
        app.logger.exception("Assistant chat failed: %s", exc)
        return json_response(
            "The AI assistant could not process your request.",
            success=False,
            status=500,
        )

    backend_order_id = None
    if prediction.intent == "order_checkout" and prediction.placed_order:
        placed_order = prediction.placed_order
        backend_order_id = placed_order.get("backendOrderId")

    live_assistant = _assistant_enrich_live_response(
        message,
        prediction,
        backend_order_id=backend_order_id,
    )

    return json_response(
        "Assistant reply generated.",
        data={
            "reply": live_assistant["reply"],
            "intent": prediction.intent,
            "confidence": round(prediction.confidence, 4),
            "suggestions": live_assistant["suggestions"],
            "menuItems": prediction.menu_items,
            "cart": prediction.cart,
            "sessionId": prediction.session_id,
            "source": prediction.source,
            "backendOrderId": backend_order_id,
            "placedBooking": prediction.placed_booking,
            "liveContext": live_assistant["live_context"],
        },
        meta={"assistant_available": True},
    )


@app.route("/api/assistant/faqs", methods=["GET"])
def assistant_faqs():
    if assistant_service is None:
        return _assistant_unavailable_response()

    try:
        faqs = assistant_service.restaurant.list_faqs()
    except Exception as exc:
        app.logger.exception("Assistant FAQs failed: %s", exc)
        return json_response(
            "The AI assistant FAQs could not be loaded.",
            success=False,
            status=500,
        )

    return json_response(
        "Assistant FAQs loaded.",
        data={"faqs": faqs},
        meta={"assistant_available": True},
    )


@app.route("/api/assistant/meta", methods=["GET"])
def assistant_meta():
    if assistant_service is None:
        return _assistant_unavailable_response()

    try:
        restaurant = assistant_service.restaurant
        return json_response(
            "Assistant metadata loaded.",
            data={
                "brand": restaurant.brand_name,
                "supportHours": restaurant.support_hours,
                "phone": restaurant.support_phone,
                "email": restaurant.support_email,
                "branches": restaurant.list_branches(),
            },
            meta={"assistant_available": True},
        )
    except Exception as exc:
        app.logger.exception("Assistant metadata failed: %s", exc)
        return json_response(
            "The AI assistant metadata could not be loaded.",
            success=False,
            status=500,
        )


@app.route("/logout")
def logout():
    user_id = session.get("user_id")
    session.clear()
    if user_id:
        _log_activity(user_id, "logout")
    return json_response("Logged out.")



# ── Dev server ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
