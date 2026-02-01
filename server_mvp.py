from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from openpyxl import load_workbook
import os
import gc
from datetime import datetime

app = Flask(__name__)
CORS(app)

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI")
mongo_client = None
db = None
COLLECTION_NAME = 'danalog_catalog'

def get_db():
    """Get database connection, initialize if needed"""
    global mongo_client, db
    if db is None and MONGO_URI:
        try:
            mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            # Use explicit database name
            db = mongo_client['ayal_kore']
            # Test connection
            mongo_client.admin.command('ping')
            print("MongoDB connected successfully")
        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            return None
    return db

def init_db():
    """Create indexes if they don't exist"""
    database = get_db()
    if database is None:
        return

    collection = database[COLLECTION_NAME]

    # Create unique index on דאנאקוד
    collection.create_index("דאנאקוד", unique=True, sparse=True)

    # Create indexes for faster searching
    collection.create_index("שם")
    collection.create_index("מחבר")
    collection.create_index("נושא")
    collection.create_index("ברקוד")

@app.route('/')
def index():
    """Health check endpoint"""
    database = get_db()
    return jsonify({
        'status': 'running',
        'message': 'Ayal Kore Catalog Server',
        'database_connected': database is not None
    })

@app.route('/upload', methods=['POST'])
def upload_danalog():
    """Upload Danalog Excel file and import into MongoDB (memory-optimized)"""
    database = get_db()
    if database is None:
        return jsonify({'error': 'Database not available. Please check MongoDB connection.'}), 500

    try:
        if 'file' not in request.files:
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        # Initialize database indexes
        init_db()
        collection = database[COLLECTION_NAME]

        # Use openpyxl with read_only mode for memory efficiency
        wb = load_workbook(file, read_only=True, data_only=True)
        ws = wb.active

        added_count = 0
        skipped_count = 0
        headers = None

        for row_num, row in enumerate(ws.iter_rows(values_only=True)):
            # First row is headers
            if row_num == 0:
                headers = list(row)
                continue

            # Skip empty rows
            if not any(row):
                continue

            # Build document from row
            doc = {}
            danalog_code = None
            for i, value in enumerate(row):
                if i < len(headers) and headers[i]:
                    col_name = headers[i]
                    doc[col_name] = value if value is not None else None
                    if col_name == 'דאנאקוד':
                        danalog_code = value

            # Check for duplicate
            if danalog_code:
                existing = collection.find_one({"דאנאקוד": danalog_code})
                if existing:
                    skipped_count += 1
                    continue

            # Add timestamp
            doc['created_at'] = datetime.utcnow()

            try:
                collection.insert_one(doc)
                added_count += 1
            except Exception as e:
                if 'duplicate key' in str(e).lower():
                    skipped_count += 1
                else:
                    raise e

        # Close workbook and free memory
        wb.close()
        gc.collect()

        total_count = collection.count_documents({})

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
    """Search catalog by column and text"""
    database = get_db()
    if database is None:
        return jsonify({'error': 'Database not available. Please check MongoDB connection.'}), 500

    try:
        column = request.args.get('column')
        search_text = request.args.get('text')

        if not column or not search_text:
            return jsonify({'error': 'חסרים פרמטרים לחיפוש'}), 400

        collection = database[COLLECTION_NAME]

        # Check if database has data
        if collection.count_documents({}) == 0:
            return jsonify({'error': 'מסד הנתונים ריק. אנא העלה קטלוג תחילה'}), 400

        # Build search query - use regex for partial matching
        query = {column: {"$regex": search_text, "$options": "i"}}

        # Projection to return only important fields
        projection = {
            "_id": 0,
            "ID": 1,
            "דאנאקוד": 1,
            "שם": 1,
            "ת.מחלקה": 1,
            "מחיר": 1,
            "מחבר": 1,
            "נושא": 1,
            "ברקוד": 1,
            "ת.פתיחה": 1,
            "ת.עדכון": 1,
            "ת.מה.ראשונה": 1
        }

        results = list(collection.find(query, projection))

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
    database = get_db()
    if database is None:
        return jsonify({
            'database_exists': False,
            'total_books': 0,
            'message': 'Database not available. Please check MongoDB connection.'
        })

    try:
        collection = database[COLLECTION_NAME]
        total_count = collection.count_documents({})

        return jsonify({
            'database_exists': True,
            'total_books': total_count
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    print("Starting Ayal Kore Catalog Server...")
    app.run(debug=True, host='0.0.0.0', port=5000)
