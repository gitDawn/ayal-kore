from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database file path
DB_PATH = 'danalog_catalog.db'

# Initialize database
def init_db():
    """Create the database and tables if they don't exist"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create Danalog catalog table with all fields from the Excel
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS danalog_catalog (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            "ש.לפריט" TEXT,
            "דאנאקוד" TEXT UNIQUE,
            "שם" TEXT,
            "ק.מחלקה" TEXT,
            "ת.מחלקה" TEXT,
            "מחיר" REAL,
            "מ.מיוחד" REAL,
            "מ.מיוחד1" REAL,
            "לימוד" TEXT,
            "מאושר" TEXT,
            "ק.יצרן" TEXT,
            "יצרן" TEXT,
            "ק.מחבר" TEXT,
            "מחבר" TEXT,
            "ק.נושא" TEXT,
            "נושא" TEXT,
            "אזל" TEXT,
            "ברקוד" TEXT,
            "ברקוד-נ" TEXT,
            "פמי.ר" TEXT,
            "פמי.מ" TEXT,
            "ת.פתיחה" TEXT,
            "ת.עדכון" TEXT,
            "ת.מה.ראשונה" TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create index on דאנאקוד for faster lookups
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_danalog_code
        ON danalog_catalog("דאנאקוד")
    ''')

    conn.commit()
    conn.close()

# Check if database exists
def db_exists():
    """Check if database file exists and has data"""
    if not os.path.exists(DB_PATH):
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM danalog_catalog")
    count = cursor.fetchone()[0]
    conn.close()

    return count > 0

@app.route('/upload', methods=['POST'])
def upload_danalog():
    """
    Upload Danalog Excel file and import into database
    - If no database exists, create new records with auto-incrementing IDs
    - If database exists, check each record by דאנאקוד field
      - Skip if exists
      - Add with new unique ID if doesn't exist
    """
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        # Read Excel file
        df = pd.read_excel(file)

        # Initialize database if not exists
        init_db()

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        added_count = 0
        skipped_count = 0

        # Get column names from the DataFrame
        columns = df.columns.tolist()

        for index, row in df.iterrows():
            danalog_code = row.get('דאנאקוד', None)

            # Check if record already exists
            if danalog_code:
                cursor.execute('SELECT ID FROM danalog_catalog WHERE "דאנאקוד" = ?', (danalog_code,))
                existing = cursor.fetchone()

                if existing:
                    skipped_count += 1
                    continue

            # Prepare data for insertion (excluding ID, will auto-increment)
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join([f'"{col}"' for col in columns])

            values = [row[col] if pd.notna(row[col]) else None for col in columns]

            # Insert new record
            cursor.execute(
                f'INSERT INTO danalog_catalog ({column_names}) VALUES ({placeholders})',
                values
            )
            added_count += 1

        conn.commit()

        # Get total count
        cursor.execute('SELECT COUNT(*) FROM danalog_catalog')
        total_count = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            'success': True,
            'added': added_count,
            'skipped': skipped_count,
            'total': total_count
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search', methods=['GET'])
def search_catalog():
    """
    Search catalog by column and text
    Returns matching records with only important fields displayed
    """
    try:
        column = request.args.get('column')
        search_text = request.args.get('text')

        if not column or not search_text:
            return jsonify({'error': 'חסרים פרמטרים לחיפוש'}), 400

        # Check if database exists
        if not db_exists():
            return jsonify({'error': 'מסד הנתונים ריק. אנא העלה קטלוג תחילה'}), 400

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        cursor = conn.cursor()

        # Build search query - use LIKE for partial matching
        query = f'''
            SELECT
                ID,
                "דאנאקוד",
                "שם",
                "ת.מחלקה",
                "מחיר",
                "מחבר",
                "נושא",
                "ברקוד",
                "ת.פתיחה",
                "ת.עדכון",
                "ת.מה.ראשונה"
            FROM danalog_catalog
            WHERE "{column}" LIKE ?
        '''

        cursor.execute(query, (f'%{search_text}%',))
        rows = cursor.fetchall()

        # Convert rows to list of dictionaries
        results = [dict(row) for row in rows]

        conn.close()

        return jsonify({
            'success': True,
            'results': results,
            'count': len(results)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get database statistics"""
    try:
        if not os.path.exists(DB_PATH):
            return jsonify({
                'database_exists': False,
                'total_books': 0
            })

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Get total count
        cursor.execute('SELECT COUNT(*) FROM danalog_catalog')
        total_count = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            'database_exists': True,
            'total_books': total_count
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'message': 'Ayal Kore Catalog API'
    })

if __name__ == '__main__':
    # Initialize database on startup
    init_db()

    # Run server
    print("Starting Ayal Kore Catalog Server...")
    print("Server running on http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
