from datetime import date


def get_today_sales(mysql):
    """
    Return today's total sales and order count.

    Uses server local date and MySQL CURDATE() to match timezone on the DB.
    """
    cur = mysql.connection.cursor()
    try:
        cur.execute(
            """
            SELECT
                COALESCE(SUM(total), 0) AS total_sales,
                COUNT(*) AS order_count
            FROM orders
            WHERE DATE(created_at) = CURDATE()
            """
        )
        row = cur.fetchone()
        total_sales = float(row[0] or 0)
        order_count = int(row[1] or 0)
        return {
            "date": date.today().isoformat(),
            "total_sales": total_sales,
            "order_count": order_count,
        }
    finally:
        cur.close()


def get_admin_dashboard_metrics(mysql):
    cur = mysql.connection.cursor()
    try:
        # Orders today (split by type) + revenue
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_orders,
                SUM(order_type = 'online') AS online_orders,
                SUM(order_type = 'dine_in') AS dine_in_orders,
                COALESCE(SUM(total), 0) AS total_revenue
            FROM orders
            WHERE DATE(created_at) = CURDATE()
            """
        )
        row = cur.fetchone() or (0, 0, 0, 0)
        total_orders = int(row[0] or 0)
        online_orders = int(row[1] or 0)
        dine_in_orders = int(row[2] or 0)
        today_revenue = float(row[3] or 0)

        # Pending kitchen orders today
        cur.execute(
            """
            SELECT COUNT(*)
            FROM orders
            WHERE DATE(created_at) = CURDATE()
              AND status IN ('pending','placed','preparing')
            """
        )
        pending_kitchen = int((cur.fetchone() or (0,))[0] or 0)

        # Table occupancy snapshot
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_tables,
                SUM(status = 'available') AS available_tables,
                SUM(status = 'reserved') AS reserved_tables,
                SUM(status = 'occupied') AS occupied_tables
            FROM restaurant_tables
            """
        )
        table_row = cur.fetchone() or (0, 0, 0, 0)
        table_metrics = {
            "total": int(table_row[0] or 0),
            "available": int(table_row[1] or 0),
            "reserved": int(table_row[2] or 0),
            "occupied": int(table_row[3] or 0),
        }

        # Revenue summary: last 7 days and this month
        cur.execute(
            """
            SELECT
                COALESCE(SUM(total), 0) AS week_total
            FROM orders
            WHERE DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()
            """
        )
        week_total = float((cur.fetchone() or (0,))[0] or 0)

        cur.execute(
            """
            SELECT
                COALESCE(SUM(total), 0) AS month_total
            FROM orders
            WHERE YEAR(created_at) = YEAR(CURDATE())
              AND MONTH(created_at) = MONTH(CURDATE())
            """
        )
        month_total = float((cur.fetchone() or (0,))[0] or 0)

        # Peak hours chart (last 7 days)
        cur.execute(
            """
            SELECT HOUR(created_at) AS hour_of_day, COUNT(*) AS order_count
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY HOUR(created_at)
            ORDER BY hour_of_day
            """
        )
        peak_hours = []
        for hour, count in cur.fetchall() or []:
            peak_hours.append({"hour": int(hour), "count": int(count)})

        peak_hour_label = ""
        if peak_hours:
            max_item = max(peak_hours, key=lambda item: item["count"])
            peak_hour_label = f"{max_item['hour']:02d}:00"

        # Monthly revenue graph (last 6 months)
        cur.execute(
            """
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month_key,
                COALESCE(SUM(total), 0) AS total
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month_key
            """
        )
        monthly_revenue = [
            {"month": row[0], "total": float(row[1] or 0)}
            for row in (cur.fetchall() or [])
        ]

        return {
            "date": date.today().isoformat(),
            "today": {
                "total_orders": total_orders,
                "revenue": today_revenue,
                "pending_kitchen": pending_kitchen,
                "online": online_orders,
                "dine_in": dine_in_orders,
            },
            "orders": {
                "total": total_orders,
                "online": online_orders,
                "dine_in": dine_in_orders,
            },
            "tables": table_metrics,
            "revenue": {
                "week_total": week_total,
                "month_total": month_total,
            },
            "peak_hours": {
                "label": peak_hour_label,
                "data": peak_hours,
            },
            "monthly_revenue": monthly_revenue,
        }
    finally:
        cur.close()
