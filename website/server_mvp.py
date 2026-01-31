from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'message': 'Ayal Kore MVP Server',
        'version': '1.0.0'
    })

@app.route('/upload', methods=['POST'])
def upload_danalog():
    """Mock upload endpoint - just returns success for testing"""
    if 'file' not in request.files:
        return jsonify({'error': 'לא נבחר קובץ'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'לא נבחר קובץ'}), 400

    # Mock response - in real version this would process the Excel file
    return jsonify({
        'success': True,
        'added': 5,
        'skipped': 0,
        'total': 5,
        'message': 'MVP: File upload simulated successfully'
    })

@app.route('/search', methods=['GET'])
def search_catalog():
    """Mock search endpoint - returns sample data"""
    column = request.args.get('column', 'שם')
    search_text = request.args.get('text', '')

    # Mock data for testing
    mock_results = [
        {
            'ID': 1,
            'דאנאקוד': '12345',
            'שם': 'ספר לדוגמה',
            'מחבר': 'מחבר לדוגמה',
            'נושא': 'נושא לדוגמה',
            'מחיר': 50.0,
            'ברקוד': '123456789'
        }
    ]

    return jsonify({
        'success': True,
        'results': mock_results,
        'count': len(mock_results)
    })

@app.route('/stats', methods=['GET'])
def get_stats():
    """Mock stats endpoint"""
    return jsonify({
        'database_exists': True,
        'total_books': 5,
        'message': 'MVP: Mock statistics'
    })

if __name__ == '__main__':
    print("Starting Ayal Kore MVP Server...")
    print("This is a minimal version for testing basic functionality")
    print("Server running on http://localhost:5000")
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))