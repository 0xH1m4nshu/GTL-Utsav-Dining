import json

from flask import Blueprint, current_app, request


def create_admin_order_blueprint(
    mysql,
    json_response,
    require_roles,
    get_request_data,
    get_current_user,
    apply_date_range,
    parse_pagination,
):
    blueprint = Blueprint("admin_order_routes", __name__)

    def normalize_items(raw_items):
        if not raw_items:
            return []
        if isinstance(raw_items, str):
            try:
                raw_items = json.loads(raw_items)
            except Exception:
                return []
        return raw_items if isinstance(raw_items, list) else []

    @blueprint.route("/orders", methods=["GET", "POST"])
    def orders():
        if request.method == "POST":
            payload = get_request_data()
            raw_uid = payload.get("user_id") or get_current_user()
            user_id = str(raw_uid).strip() if raw_uid is not None and str(raw_uid).strip() else None
            items = normalize_items(payload.get("items"))
            address = str(payload.get("address", "")).strip() or "Dine-in"
            order_type = str(payload.get("order_type", "online")).strip() or "online"
            table_id = payload.get("table_id")
            payment_status = str(payload.get("payment_status", "unpaid")).strip() or "unpaid"
            payment_method = str(payload.get("payment_method", "")).strip() or None

            if not user_id:
                return json_response("Missing user.", success=False, status=400)

            computed_total = 0
            for item in items:
                qty = int(item.get("qty", 1) or 1)
                price = float(item.get("price", 0) or 0)
                computed_total += qty * price
            total = float(payload.get("total", computed_total) or computed_total)

            cur = mysql.connection.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO orders (user_id, items, total, address, status, order_type, table_id, payment_status, payment_method)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        json.dumps(items),
                        total,
                        address,
                        "placed",
                        order_type,
                        table_id,
                        payment_status,
                        payment_method,
                    ),
                )
                order_id = cur.lastrowid
                for item in items:
                    cur.execute(
                        """
                        INSERT INTO order_items (order_id, item_id, item_name, qty, price)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            order_id,
                            item.get("id"),
                            item.get("name", "Item"),
                            int(item.get("qty", 1) or 1),
                            float(item.get("price", 0) or 0),
                        ),
                    )
                if order_type == "dine_in" and table_id:
                    cur.execute(
                        "UPDATE restaurant_tables SET status = 'occupied' WHERE id = %s",
                        (table_id,),
                    )
                mysql.connection.commit()
                return json_response("Order placed.", data={"id": order_id})
            except Exception as exc:
                current_app.logger.error("Order create failed: %s", exc)
                return json_response("Unable to place order.", success=False, status=500)
            finally:
                cur.close()

        user_id = request.args.get("user_id") or get_current_user()
        if not user_id:
            return json_response("Missing user.", success=False, status=400)
        status = request.args.get("status")
        clauses = ["user_id = %s"]
        params = [user_id]
        if status:
            clauses.append("status = %s")
            params.append(status)
        where = " AND ".join(clauses)
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                f"""
                SELECT id, user_id, items, total, address, status, order_type, table_id,
                       payment_status, payment_method, created_at, updated_at
                FROM orders
                WHERE {where}
                ORDER BY created_at DESC
                """,
                params,
            )
            rows = cur.fetchall() or []
            result = []
            for row in rows:
                result.append(
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "items": normalize_items(row[2]),
                        "total": float(row[3] or 0),
                        "address": row[4],
                        "status": row[5],
                        "order_type": row[6],
                        "table_id": row[7],
                        "payment_status": row[8],
                        "payment_method": row[9],
                        "created_at": row[10].isoformat() if row[10] else None,
                        "updated_at": row[11].isoformat() if row[11] else None,
                    }
                )
            return json_response("Orders", data=result)
        except Exception as exc:
            current_app.logger.error("Order fetch failed: %s", exc)
            return json_response("Unable to load orders.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/orders/<int:order_id>")
    def order_detail(order_id):
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                """
                SELECT id, user_id, items, total, address, status, order_type, table_id,
                       payment_status, payment_method, created_at, updated_at
                FROM orders
                WHERE id = %s
                """,
                (order_id,),
            )
            row = cur.fetchone()
            if not row:
                return json_response("Order not found.", success=False, status=404)
            return json_response(
                "Order details",
                data={
                    "id": row[0],
                    "user_id": row[1],
                    "items": normalize_items(row[2]),
                    "total": float(row[3] or 0),
                    "address": row[4],
                    "status": row[5],
                    "order_type": row[6],
                    "table_id": row[7],
                    "payment_status": row[8],
                    "payment_method": row[9],
                    "created_at": row[10].isoformat() if row[10] else None,
                    "updated_at": row[11].isoformat() if row[11] else None,
                },
            )
        except Exception as exc:
            current_app.logger.error("Order detail failed: %s", exc)
            return json_response("Unable to load order.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/orders/<int:order_id>/tracking")
    def order_tracking(order_id):
        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT status FROM orders WHERE id = %s", (order_id,))
            row = cur.fetchone()
            if not row:
                return json_response("Order not found.", success=False, status=404)
            status = row[0]
            stages = ["placed", "preparing", "ready", "out_for_delivery", "completed"]
            return json_response("Order status", data={"status": status, "stages": stages})
        except Exception as exc:
            current_app.logger.error("Order tracking failed: %s", exc)
            return json_response("Unable to load order status.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/orders")
    @require_roles("admin", "staff")
    def admin_orders():
        order_type = request.args.get("type")
        status = request.args.get("status")
        payment_status = request.args.get("payment_status")
        query = request.args.get("q")
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
        apply_date_range(clauses, params, column="created_at")
        if query:
            like = f"%{query.strip()}%"
            clauses.append("(user_id LIKE %s OR CAST(id AS CHAR) LIKE %s)")
            params.extend([like, like])
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        page, page_size, offset = parse_pagination()
        cur = mysql.connection.cursor()
        try:
            cur.execute(f"SELECT COUNT(*) FROM orders {where}", params)
            total = int((cur.fetchone() or (0,))[0] or 0)
            cur.execute(
                f"""
                SELECT id, user_id, items, total, address, status, order_type, table_id,
                       payment_status, payment_method, created_at, kitchen_accepted_by, kitchen_accepted_at
                FROM orders
                {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [page_size, offset],
            )
            orders_list = []
            for row in cur.fetchall() or []:
                orders_list.append(
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "items": normalize_items(row[2]),
                        "total": float(row[3] or 0),
                        "address": row[4],
                        "status": row[5],
                        "order_type": row[6],
                        "table_id": row[7],
                        "payment_status": row[8],
                        "payment_method": row[9],
                        "created_at": row[10].isoformat() if row[10] else None,
                        "kitchen_accepted_by": row[11],
                        "kitchen_accepted_at": row[12].isoformat() if row[12] else None,
                    }
                )
            meta = {
                "page": page,
                "page_size": page_size,
                "total": total,
                "has_more": offset + page_size < total,
            }
            return json_response("Orders", data=orders_list, meta=meta)
        except Exception as exc:
            current_app.logger.error("Admin order fetch failed: %s", exc)
            return json_response("Unable to load orders.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/orders/<int:order_id>/status", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_order_status(order_id):
        payload = get_request_data()
        status = str(payload.get("status", "")).strip()
        if not status:
            return json_response("Status is required.", success=False, status=400)
        if status not in {"placed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"}:
            return json_response("Invalid order status.", success=False, status=400)
        cur = mysql.connection.cursor()
        try:
            cur.execute(
                "SELECT table_id, order_type FROM orders WHERE id = %s",
                (order_id,),
            )
            existing = cur.fetchone()
            if not existing:
                return json_response("Order not found.", success=False, status=404)
            table_id, order_type = existing

            cur.execute("UPDATE orders SET status = %s WHERE id = %s", (status, order_id))

            if order_type == "dine_in" and table_id:
                if status in {"completed", "cancelled"}:
                    cur.execute(
                        "UPDATE restaurant_tables SET status = 'available' WHERE id = %s",
                        (table_id,),
                    )
                elif status in {"placed", "preparing", "ready"}:
                    cur.execute(
                        "UPDATE restaurant_tables SET status = 'occupied' WHERE id = %s",
                        (table_id,),
                    )
            mysql.connection.commit()
            return json_response("Order status updated.")
        except Exception as exc:
            current_app.logger.error("Order status update failed: %s", exc)
            return json_response("Unable to update order.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/orders/<int:order_id>/kitchen-acceptance", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_kitchen_acceptance(order_id):
        payload = get_request_data()
        accepted = payload.get("accepted")
        accepted = accepted if isinstance(accepted, bool) else str(accepted).strip().lower() in {"1", "true", "yes", "y", "on"}
        current_user = get_current_user()

        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT id FROM orders WHERE id = %s", (order_id,))
            if not cur.fetchone():
                return json_response("Order not found.", success=False, status=404)

            if accepted:
                cur.execute(
                    """
                    UPDATE orders
                    SET kitchen_accepted_by = %s,
                        kitchen_accepted_at = NOW()
                    WHERE id = %s
                    """,
                    (current_user or "staff", order_id),
                )
                message = "Kitchen ticket accepted."
            else:
                cur.execute(
                    """
                    UPDATE orders
                    SET kitchen_accepted_by = NULL,
                        kitchen_accepted_at = NULL
                    WHERE id = %s
                    """,
                    (order_id,),
                )
                message = "Kitchen ticket acceptance cleared."

            mysql.connection.commit()
            return json_response(message)
        except Exception as exc:
            current_app.logger.error("Kitchen acceptance update failed: %s", exc)
            return json_response("Unable to update kitchen acceptance.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/orders/<int:order_id>/payment", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_order_payment(order_id):
        payload = get_request_data()
        payment_status = str(payload.get("payment_status", "")).strip()
        payment_method = str(payload.get("payment_method", "")).strip()
        if not payment_status:
            return json_response("Payment status is required.", success=False, status=400)
        if payment_status not in {"unpaid", "paid", "refunded"}:
            return json_response("Invalid payment status.", success=False, status=400)
        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT id FROM orders WHERE id = %s", (order_id,))
            if not cur.fetchone():
                return json_response("Order not found.", success=False, status=404)
            cur.execute(
                "UPDATE orders SET payment_status = %s, payment_method = %s WHERE id = %s",
                (payment_status, payment_method or None, order_id),
            )
            mysql.connection.commit()
            return json_response("Payment updated.")
        except Exception as exc:
            current_app.logger.error("Payment update failed: %s", exc)
            return json_response("Unable to update payment.", success=False, status=500)
        finally:
            cur.close()

    return blueprint
