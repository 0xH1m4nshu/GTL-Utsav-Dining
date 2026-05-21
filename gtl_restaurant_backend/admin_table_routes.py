import base64
import io
import os
import socket
from pathlib import Path
from urllib.parse import urlencode, urlparse

import qrcode
from flask import Blueprint, current_app, redirect, request
from itsdangerous import URLSafeSerializer
from PIL import Image, ImageDraw, ImageFont


def create_admin_table_blueprint(
    mysql,
    json_response,
    require_roles,
    get_request_data,
    apply_date_range,
    parse_pagination,
):
    blueprint = Blueprint("admin_table_routes", __name__)

    def record_table_status_event(cur, table_id, status):
        cur.execute(
            """
            INSERT INTO table_occupancy_events (table_id, status)
            VALUES (%s, %s)
            """,
            (table_id, status),
        )

    def set_table_status(cur, table_id, status):
        if not table_id:
            return
        cur.execute("UPDATE restaurant_tables SET status = %s WHERE id = %s", (status, table_id))
        if cur.rowcount:
            record_table_status_event(cur, table_id, status)

    def _table_qr_serializer():
        return URLSafeSerializer(current_app.secret_key, salt="table-menu-qr")

    def _resolve_frontend_url():
        configured_public = str(current_app.config.get("PUBLIC_FRONTEND_URL", "") or "").strip()
        if configured_public:
            return configured_public.rstrip("/")

        configured = str(current_app.config.get("FRONTEND_URL", "http://localhost:5173") or "").rstrip("/")
        parsed = urlparse(configured)
        configured_host = (parsed.hostname or "").lower()
        if configured_host in {"localhost", "127.0.0.1"}:
            request_host = request.host.split(":", 1)[0].strip().lower()
            candidate_host = request_host if request_host and request_host not in {"localhost", "127.0.0.1"} else ""
            if not candidate_host:
                candidate_host = _detect_lan_host()
            if candidate_host:
                scheme = parsed.scheme or request.scheme or "http"
                port = parsed.port or 5173
                return f"{scheme}://{candidate_host}:{port}"
        return configured or "http://localhost:5173"

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

    def build_table_menu_link(table_id, table_code):
        serializer = _table_qr_serializer()
        token = serializer.dumps({"table_id": table_id, "table_code": table_code})
        frontend_url = _resolve_frontend_url()
        params = urlencode(
            {
                "dine_in": "1",
                "table_id": table_id,
                "table": table_code,
                "qr_token": token,
            }
        )
        menu_url = f"{frontend_url}/order-online?{params}"
        short_url = f"{request.host_url.rstrip('/')}/q/{token}"
        return menu_url, short_url

    @blueprint.route("/q/<token>")
    def resolve_table_menu_short_url(token):
        try:
            payload = _table_qr_serializer().loads(token)
            table_id = payload.get("table_id")
            table_code = payload.get("table_code")
            if not table_id or not table_code:
                raise ValueError("invalid qr token payload")
            menu_url, _ = build_table_menu_link(table_id, table_code)
            return redirect(menu_url, code=302)
        except Exception:
            return json_response("Invalid or expired table QR link.", success=False, status=404)

    def render_qr_data_uri(target_url):
        image = qrcode.make(target_url)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    def _load_font(size, bold=False):
        candidates = [
            "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        ]
        for candidate in candidates:
            try:
                return ImageFont.truetype(candidate, size=size)
            except Exception:
                continue
        return ImageFont.load_default()

    def _find_logo_path():
        static_dir = Path(current_app.static_folder or "")
        assets_dir = static_dir / "assets"
        logo_candidates = []
        if assets_dir.exists():
            logo_candidates.extend(sorted(assets_dir.glob("logo-*.png")))
            logo_candidates.extend(sorted(assets_dir.glob("logo*.png")))
        uploads_dir = static_dir / "uploads"
        if uploads_dir.exists():
            logo_candidates.extend(sorted(uploads_dir.glob("logo*.png")))
        return logo_candidates[0] if logo_candidates else None

    def _shorten_label(value, limit=44):
        text = str(value or "")
        if len(text) <= limit:
            return text
        return f"{text[:limit - 3]}..."

    def render_branded_card_data_uri(table_code, qr_target_url, short_url):
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
        qr.add_data(qr_target_url)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((420, 420))

        card_width = 760
        card_height = 1100
        card = Image.new("RGB", (card_width, card_height), "#ffffff")
        draw = ImageDraw.Draw(card)

        draw.rectangle((0, 0, card_width, 140), fill="#341E0F")
        draw.rectangle((0, 132, card_width, 140), fill="#E5AF51")

        title_font = _load_font(44, bold=True)
        subtitle_font = _load_font(30, bold=True)
        body_font = _load_font(22, bold=False)
        url_font = _load_font(20, bold=False)

        draw.text((36, 34), "GTL Utsav Dining", fill="#E5AF51", font=title_font)
        draw.text((36, 86), "Scan To Open Digital Menu", fill="#FFFFFF", font=subtitle_font)

        logo_path = _find_logo_path()
        if logo_path:
            try:
                logo = Image.open(logo_path).convert("RGBA")
                logo.thumbnail((130, 130))
                logo_x = card_width - logo.width - 28
                logo_y = 8
                card.paste(logo, (logo_x, logo_y), logo)
            except Exception:
                pass

        qr_x = (card_width - qr_image.width) // 2
        qr_y = 220
        card.paste(qr_image, (qr_x, qr_y))
        draw.rectangle((qr_x - 12, qr_y - 12, qr_x + qr_image.width + 12, qr_y + qr_image.height + 12), outline="#E5AF51", width=3)

        draw.text((40, 680), f"Table: {table_code}", fill="#341E0F", font=_load_font(42, bold=True))
        draw.text((40, 754), "Fallback Short URL", fill="#341E0F", font=body_font)
        draw.text((40, 792), _shorten_label(short_url, limit=58), fill="#0F3D66", font=url_font)
        draw.text((40, 850), "If QR does not scan, type this URL in browser.", fill="#6B7280", font=body_font)

        draw.rectangle((40, 910, card_width - 40, 1038), fill="#FFF7E8", outline="#E5AF51", width=2)
        draw.text((64, 948), "Dine-in menu opens directly for this table.", fill="#341E0F", font=body_font)

        buffer = io.BytesIO()
        card.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    @blueprint.route("/tables")
    def list_tables():
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                "SELECT id, table_code, seats, status FROM restaurant_tables ORDER BY table_code"
            )
            tables = [
                {
                    "id": row[0],
                    "table_code": row[1],
                    "seats": int(row[2] or 0),
                    "status": row[3],
                }
                for row in cur.fetchall() or []
            ]
            return json_response("Tables", data=tables)
        except Exception as exc:
            current_app.logger.error("Table fetch failed: %s", exc)
            return json_response("Unable to load tables.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/tables", methods=["POST"])
    @require_roles("admin", "staff")
    def admin_create_table():
        payload = get_request_data()
        table_code = str(payload.get("table_code", "")).strip()
        seats = int(payload.get("seats", 4) or 4)
        if not table_code:
            return json_response("Table code is required.", success=False, status=400)
        if seats < 1:
            return json_response("Seats must be at least 1.", success=False, status=400)
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                "INSERT INTO restaurant_tables (table_code, seats) VALUES (%s, %s)",
                (table_code, seats),
            )
            table_id = cur.lastrowid
            record_table_status_event(cur, table_id, "available")
            mysql.connection.commit()
            return json_response("Table created.", data={"id": table_id})
        except Exception as exc:
            current_app.logger.error("Table create failed: %s", exc)
            return json_response("Unable to create table.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/tables/<int:table_id>/menu-qr")
    @require_roles("admin", "staff")
    def admin_table_menu_qr(table_id):
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                "SELECT id, table_code FROM restaurant_tables WHERE id = %s",
                (table_id,),
            )
            row = cur.fetchone()
            if not row:
                return json_response("Table not found.", success=False, status=404)
            _, table_code = row
            menu_url, short_url = build_table_menu_link(table_id, table_code)
            qr_image = render_qr_data_uri(short_url)
            branded_card_image = render_branded_card_data_uri(table_code, short_url, short_url)
            return json_response(
                "Table menu QR generated.",
                data={
                    "table_id": table_id,
                    "table_code": table_code,
                    "menu_url": menu_url,
                    "short_url": short_url,
                    "qr_image": qr_image,
                    "branded_card_image": branded_card_image,
                },
            )
        except Exception as exc:
            current_app.logger.error("Table QR generation failed: %s", exc)
            return json_response("Unable to generate table QR.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/tables/<int:table_id>", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_table(table_id):
        payload = get_request_data()
        fields = []
        params = []
        next_status = None
        if "table_code" in payload:
            table_code = str(payload.get("table_code", "")).strip()
            if not table_code:
                return json_response("Table code is required.", success=False, status=400)
            fields.append("table_code = %s")
            params.append(table_code)
        if "seats" in payload:
            seats = int(payload.get("seats", 0) or 0)
            if seats < 1:
                return json_response("Seats must be at least 1.", success=False, status=400)
            fields.append("seats = %s")
            params.append(seats)
        if "status" in payload:
            next_status = str(payload.get("status", "")).strip()
            if next_status not in {"available", "reserved", "occupied"}:
                return json_response("Invalid table status.", success=False, status=400)
            fields.append("status = %s")
            params.append(next_status)
        if not fields:
            return json_response("Nothing to update.", success=False, status=400)
        params.append(table_id)
        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT id FROM restaurant_tables WHERE id = %s", (table_id,))
            if not cur.fetchone():
                return json_response("Table not found.", success=False, status=404)
            cur.execute(f"UPDATE restaurant_tables SET {', '.join(fields)} WHERE id = %s", params)
            if next_status:
                record_table_status_event(cur, table_id, next_status)
            mysql.connection.commit()
            return json_response("Table updated.")
        except Exception as exc:
            current_app.logger.error("Table update failed: %s", exc)
            return json_response("Unable to update table.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/tables/<int:table_id>", methods=["DELETE"])
    @require_roles("admin", "staff")
    def admin_delete_table(table_id):
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                """
                SELECT COUNT(*)
                FROM bookings
                WHERE table_id = %s AND status IN ('pending', 'confirmed')
                """,
                (table_id,),
            )
            active_bookings = int((cur.fetchone() or (0,))[0] or 0)
            if active_bookings:
                return json_response(
                    "Cannot delete a table with active bookings.",
                    success=False,
                    status=409,
                )
            cur.execute(
                """
                SELECT COUNT(*)
                FROM orders
                WHERE table_id = %s AND status NOT IN ('completed', 'cancelled')
                """,
                (table_id,),
            )
            active_orders = int((cur.fetchone() or (0,))[0] or 0)
            if active_orders:
                return json_response(
                    "Cannot delete a table with active dine-in orders.",
                    success=False,
                    status=409,
                )
            cur.execute("DELETE FROM table_occupancy_events WHERE table_id = %s", (table_id,))
            cur.execute("DELETE FROM restaurant_tables WHERE id = %s", (table_id,))
            if not cur.rowcount:
                mysql.connection.rollback()
                return json_response("Table not found.", success=False, status=404)
            mysql.connection.commit()
            return json_response("Table deleted.")
        except Exception as exc:
            current_app.logger.error("Table delete failed: %s", exc)
            return json_response("Unable to delete table.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/bookings")
    @require_roles("admin", "staff")
    def admin_list_bookings():
        status = request.args.get("status")
        query = request.args.get("q")
        clauses = []
        params = []
        if status:
            clauses.append("b.status = %s")
            params.append(status)
        apply_date_range(clauses, params, column="b.created_at")
        if query:
            like = f"%{query.strip()}%"
            clauses.append("(b.name LIKE %s OR b.email LIKE %s OR b.phone LIKE %s)")
            params.extend([like, like, like])
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        page, page_size, offset = parse_pagination()
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                f"""
                SELECT COUNT(*)
                FROM bookings b
                {where}
                """,
                params,
            )
            total = int((cur.fetchone() or (0,))[0] or 0)
            cur.execute(
                """
                SELECT b.id, b.user_id, b.name, b.email, b.phone, b.date, b.time, b.guests, b.message,
                       b.table_id, b.status, b.created_at, t.table_code
                FROM bookings b
                LEFT JOIN restaurant_tables t ON b.table_id = t.id
                {where}
                ORDER BY b.created_at DESC
                LIMIT %s OFFSET %s
                """.format(where=where),
                params + [page_size, offset],
            )
            bookings = []
            for row in cur.fetchall() or []:
                bookings.append(
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "name": row[2],
                        "email": row[3],
                        "phone": row[4],
                        "date": row[5].isoformat() if row[5] else None,
                        "time": str(row[6]) if row[6] else None,
                        "guests": int(row[7] or 0),
                        "message": row[8],
                        "table_id": row[9],
                        "status": row[10],
                        "created_at": row[11].isoformat() if row[11] else None,
                        "table_code": row[12],
                    }
                )
            meta = {
                "page": page,
                "page_size": page_size,
                "total": total,
                "has_more": offset + page_size < total,
            }
            return json_response("Bookings", data=bookings, meta=meta)
        except Exception as exc:
            current_app.logger.error("Booking fetch failed: %s", exc)
            return json_response("Unable to load bookings.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/bookings/<int:booking_id>", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_booking(booking_id):
        payload = get_request_data()
        fields = []
        params = []
        next_status = None
        next_table_id = None
        if "status" in payload:
            next_status = str(payload.get("status", "")).strip()
            if next_status not in {"pending", "confirmed", "cancelled"}:
                return json_response("Invalid booking status.", success=False, status=400)
            fields.append("status = %s")
            params.append(next_status)
        if "table_id" in payload:
            raw_table_id = payload.get("table_id")
            next_table_id = int(raw_table_id) if str(raw_table_id).strip() else None
            fields.append("table_id = %s")
            params.append(next_table_id)
        if not fields:
            return json_response("Nothing to update.", success=False, status=400)

        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT table_id, status FROM bookings WHERE id = %s", (booking_id,))
            current_booking = cur.fetchone()
            if not current_booking:
                return json_response("Booking not found.", success=False, status=404)
            current_table_id, current_status = current_booking

            if next_table_id:
                cur.execute("SELECT id FROM restaurant_tables WHERE id = %s", (next_table_id,))
                if not cur.fetchone():
                    return json_response("Selected table does not exist.", success=False, status=400)

            cur.execute(f"UPDATE bookings SET {', '.join(fields)} WHERE id = %s", params + [booking_id])

            effective_status = next_status or current_status
            effective_table_id = next_table_id if "table_id" in payload else current_table_id

            if current_table_id and current_table_id != effective_table_id:
                set_table_status(cur, current_table_id, "available")

            if effective_table_id:
                if effective_status == "cancelled":
                    set_table_status(cur, effective_table_id, "available")
                elif effective_status == "confirmed":
                    set_table_status(cur, effective_table_id, "reserved")

            mysql.connection.commit()
            return json_response("Booking updated.")
        except Exception as exc:
            current_app.logger.error("Booking update failed: %s", exc)
            return json_response("Unable to update booking.", success=False, status=500)
        finally:
            cur.close()

    return blueprint
