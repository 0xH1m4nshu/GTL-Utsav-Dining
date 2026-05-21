import os
import secrets

from flask import Blueprint, current_app, request
from werkzeug.utils import secure_filename


def create_admin_menu_blueprint(
    mysql,
    json_response,
    require_roles,
    get_request_data,
    parse_bool,
    upload_dir,
):
    blueprint = Blueprint("admin_menu_routes", __name__)

    @blueprint.route("/menu-items")
    def list_menu_items():
        category = request.args.get("category")
        available = request.args.get("available")
        clauses = []
        params = []
        if category:
            clauses.append("category = %s")
            params.append(category)
        if available is not None:
            clauses.append("is_available = %s")
            params.append(1 if parse_bool(available, True) else 0)
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
            items = [
                {
                    "id": row[0],
                    "name": row[1],
                    "description": row[2],
                    "price": float(row[3] or 0),
                    "category": row[4],
                    "image_url": row[5],
                    "is_available": bool(row[6]),
                    "is_veg": bool(row[7]),
                    "is_spicy": bool(row[8]),
                }
                for row in cur.fetchall() or []
            ]
            return json_response("Menu items", data=items)
        except Exception as exc:
            current_app.logger.error("Menu fetch failed: %s", exc)
            return json_response("Unable to load menu items.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/menu-items", methods=["POST"])
    @require_roles("admin", "staff")
    def admin_create_menu_item():
        payload = get_request_data()
        name = str(payload.get("name", "")).strip()
        if not name:
            return json_response("Name is required.", success=False, status=400)
        description = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip() or "mains"
        price = float(payload.get("price", 0) or 0)
        image_url = str(payload.get("image_url", "")).strip() or None
        is_available = 1 if parse_bool(payload.get("is_available", True), True) else 0
        is_veg = 1 if parse_bool(payload.get("is_veg", True), True) else 0
        is_spicy = 1 if parse_bool(payload.get("is_spicy", False), False) else 0

        cur = mysql.connection.cursor()
        try:
            cur.execute(
                """
                INSERT INTO menu_items (name, description, price, category, image_url, is_available, is_veg, is_spicy)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (name, description, price, category, image_url, is_available, is_veg, is_spicy),
            )
            mysql.connection.commit()
            return json_response("Menu item created.", data={"id": cur.lastrowid})
        except Exception as exc:
            current_app.logger.error("Menu create failed: %s", exc)
            return json_response("Unable to create menu item.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/menu-items/<int:item_id>", methods=["PUT", "PATCH"])
    @require_roles("admin", "staff")
    def admin_update_menu_item(item_id):
        payload = get_request_data()
        fields = []
        params = []
        for key, column in [
            ("name", "name"),
            ("description", "description"),
            ("price", "price"),
            ("category", "category"),
            ("image_url", "image_url"),
        ]:
            if key in payload:
                fields.append(f"{column} = %s")
                params.append(payload.get(key))
        for key, column in [
            ("is_available", "is_available"),
            ("is_veg", "is_veg"),
            ("is_spicy", "is_spicy"),
        ]:
            if key in payload:
                fields.append(f"{column} = %s")
                params.append(1 if parse_bool(payload.get(key), False) else 0)

        if not fields:
            return json_response("Nothing to update.", success=False, status=400)

        params.append(item_id)
        cur = mysql.connection.cursor()
        try:
            cur.execute("SELECT id FROM menu_items WHERE id = %s", (item_id,))
            if not cur.fetchone():
                return json_response("Menu item not found.", success=False, status=404)
            cur.execute(f"UPDATE menu_items SET {', '.join(fields)} WHERE id = %s", params)
            mysql.connection.commit()
            return json_response("Menu item updated.")
        except Exception as exc:
            current_app.logger.error("Menu update failed: %s", exc)
            return json_response("Unable to update menu item.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/menu-items/<int:item_id>", methods=["DELETE"])
    @require_roles("admin", "staff")
    def admin_delete_menu_item(item_id):
        cur = mysql.connection.cursor()
        try:
            cur.execute("DELETE FROM menu_items WHERE id = %s", (item_id,))
            if not cur.rowcount:
                mysql.connection.rollback()
                return json_response("Menu item not found.", success=False, status=404)
            mysql.connection.commit()
            return json_response("Menu item deleted.")
        except Exception as exc:
            current_app.logger.error("Menu delete failed: %s", exc)
            return json_response("Unable to delete menu item.", success=False, status=500)
        finally:
            cur.close()

    @blueprint.route("/admin/menu-items/upload-image", methods=["POST"])
    @require_roles("admin", "staff")
    def admin_upload_menu_image():
        if "image" not in request.files:
            return json_response("Missing image file.", success=False, status=400)
        file = request.files["image"]
        if not file.filename:
            return json_response("Missing image filename.", success=False, status=400)
        os.makedirs(upload_dir, exist_ok=True)
        filename = secure_filename(file.filename)
        ext = os.path.splitext(filename)[1]
        safe_name = f"{secrets.token_hex(8)}{ext}"
        file_path = os.path.join(upload_dir, safe_name)
        file.save(file_path)
        return json_response(
            "Image uploaded.",
            data={"image_url": f"/static/uploads/{safe_name}"},
        )

    return blueprint
