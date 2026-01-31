from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
import pandas as pd
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB configuration - initialize only when available
mongo = None
MONGO_AVAILABLE = False

try:
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/ayal_kore")
    app.config["MONGO_URI"] = mongo_uri
    mongo = PyMongo(app)
    MONGO_AVAILABLE = True
    print("MongoDB initialized (connection will be tested on first use)")
except Exception as e:
    print(f"MongoDB initialization failed: {e}")
    MONGO_AVAILABLE = False

# Collection name
COLLECTION_NAME = 'danalog_catalog'

# Initialize database
def init_db():
    """Create the collection and indexes if they don't exist"""
    collection = mongo.db[COLLECTION_NAME]

    # Create unique index on דאנאקוד
    collection.create_index("דאנאקוד", unique=True, sparse=True)

    # Create indexes for faster searching
    collection.create_index("שם")
    collection.create_index("מחבר")
    collection.create_index("נושא")
    collection.create_index("ברקוד")

# Check if database has data
def db_has_data():
    """Check if collection exists and has data"""
    collection = mongo.db[COLLECTION_NAME]
    return collection.count_documents({}) > 0

@app.route('/upload', methods=['POST'])
def upload_danalog():
    """
    Upload Danalog Excel file and import into MongoDB
    - Check each record by דאנאקוד field
      - Skip if exists
      - Add if doesn't exist
    """
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'Database not available. Please check MongoDB connection.'}), 500

    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'לא נבחר קובץ'}), 400

        # Read Excel file
        df = pd.read_excel(file)

        # Initialize database if needed
        init_db()

        collection = mongo.db[COLLECTION_NAME]

        added_count = 0
        skipped_count = 0

        for index, row in df.iterrows():
            danalog_code = row.get('דאנאקוד', None)

            # Check if record already exists
            if danalog_code:
                existing = collection.find_one({"דאנאקוד": danalog_code})
                if existing:
                    skipped_count += 1
                    continue

            # Prepare document
            doc = {}
            for col in df.columns:
                value = row[col]
                if pd.notna(value):
                    doc[col] = value
                else:
                    doc[col] = None

            # Add timestamp
            doc['created_at'] = datetime.utcnow()

            try:
                collection.insert_one(doc)
                added_count += 1
            except Exception as e:
                # Handle duplicate key error
                if 'duplicate key' in str(e).lower():
                    skipped_count += 1
                else:
                    raise e

        # Get total count
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
    """
    Search catalog by column and text
    Returns matching records with only important fields displayed
    """
    if not MONGO_AVAILABLE:
        return jsonify({'error': 'Database not available. Please check MongoDB connection.'}), 500

    try:
        column = request.args.get('column')
        search_text = request.args.get('text')

        if not column or not search_text:
            return jsonify({'error': 'חסרים פרמטרים לחיפוש'}), 400

        # Check if database has data
        if not db_has_data():
            return jsonify({'error': 'מסד הנתונים ריק. אנא העלה קטלוג תחילה'}), 400

        collection = mongo.db[COLLECTION_NAME]

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
    if not MONGO_AVAILABLE:
        return jsonify({
            'database_exists': False,
            'total_books': 0,
            'message': 'Database not available. Please check MongoDB connection.'
        })

    try:
        collection = mongo.db[COLLECTION_NAME]

        # Get total count
        total_count = collection.count_documents({})

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
