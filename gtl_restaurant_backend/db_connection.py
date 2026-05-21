import os
from flask_mysqldb import MySQL


def init_db(app):
    """
    Initialize MySQL connection for gtl_utsav_db.
    Set credentials via environment variables — never hardcode passwords!

    Export before running:
        export MYSQL_HOST=localhost
        export MYSQL_USER=root
        export MYSQL_PASSWORD=your_password
        export MYSQL_DB=gtl_utsav_db
    """
    app.config['MYSQL_HOST']     = os.environ.get('MYSQL_HOST',     'localhost')
    app.config['MYSQL_USER']     = os.environ.get('MYSQL_USER',     'root')
    app.config['MYSQL_PASSWORD'] = os.environ.get('MYSQL_PASSWORD', '8055')   # set via env var
    app.config['MYSQL_DB']       = os.environ.get('MYSQL_DB',       'gtl_utsav_db')

    mysql = MySQL(app)
    return mysql
