from flask import Blueprint

from admin_dashboard import get_admin_dashboard_metrics, get_today_sales


def create_admin_dashboard_blueprint(mysql, json_response, require_roles):
    blueprint = Blueprint("admin_dashboard_routes", __name__)

    @blueprint.route("/admin/metrics/today-sales")
    @require_roles("admin", "staff")
    def admin_today_sales():
        metrics = get_today_sales(mysql)
        return json_response("Today's sales metrics", data=metrics)

    @blueprint.route("/admin/metrics/dashboard")
    @require_roles("admin", "staff")
    def admin_dashboard_metrics():
        metrics = get_admin_dashboard_metrics(mysql)
        return json_response("Admin dashboard metrics", data=metrics)

    return blueprint
