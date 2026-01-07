# Ayal Kore Book Catalog System
# מערכת קטלוג ספרים - האיל הקורא

A web-based book catalog system for managing second-hand bookstore inventory.

## Features

### 1. Upload Danalog Catalog (העלאת קטלוג דאנאלוג)
- Upload Excel files containing book catalog data
- Automatic database creation with unique ID assignment
- Smart duplicate detection - skips existing books based on Danalog code
- Support for books without Danalog codes

### 2. Search Catalog (חיפוש בקטלוג)
- Search by multiple fields:
  - Danalog Code (דאנאקוד)
  - Book Name (שם)
  - Department (מחלקה)
  - Price (מחיר)
  - Author (מחבר)
  - Subject (נושא)
  - Barcode (ברקוד)
  - Opening Date (תאריך פתיחה)
  - Update Date (תאריך עדכון)
  - First Edition (מהדורה ראשונה)
- Partial text matching
- Clean results display with only relevant fields

### 3. Database Statistics (סטטיסטיקות)
- Total books count
- Database status

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Setup Steps

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Start the Flask server:**
```bash
python server.py
```

The server will start on `http://localhost:5000`

3. **Open the website:**
Open `index.html` in your web browser, or use a local web server:
```bash
# Using Python's built-in HTTP server
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Usage Guide

### Uploading Catalog Data

1. Click on "בחר קובץ" (Choose File) in the upload section
2. Select your Danalog Excel file (`.xlsx` or `.xls`)
3. Click "העלה קטלוג" (Upload Catalog)
4. Wait for the upload to complete
5. You'll see a success message with statistics:
   - Number of new records added
   - Number of duplicate records skipped
   - Total records in database

### Searching for Books

1. Select a search field from the dropdown menu
2. Enter your search text in the text box
3. Click "חפש" (Search)
4. Results will appear in a table below

### Viewing Statistics

1. Click "טען סטטיסטיקות" (Load Statistics)
2. View the total number of books and database status

## Database Schema

### danalog_catalog Table

| Field | Type | Description |
|-------|------|-------------|
| ID | INTEGER | Auto-incrementing primary key (Internal Serial Number) |
| ש.לפריט | TEXT | Item serial number |
| דאנאקוד | TEXT | Danalog code (UNIQUE) |
| שם | TEXT | Book name/title |
| ק.מחלקה | TEXT | Department code |
| ת.מחלקה | TEXT | Department description |
| מחיר | REAL | Price |
| מ.מיוחד | REAL | Special price |
| מ.מיוחד1 | REAL | Special price 1 |
| לימוד | TEXT | Study/Educational |
| מאושר | TEXT | Approved |
| ק.יצרן | TEXT | Manufacturer code |
| יצרן | TEXT | Manufacturer |
| ק.מחבר | TEXT | Author code |
| מחבר | TEXT | Author |
| ק.נושא | TEXT | Subject code |
| נושא | TEXT | Subject |
| אזל | TEXT | Out of stock |
| ברקוד | TEXT | Barcode |
| ברקוד-נ | TEXT | Barcode-N (alternative) |
| פמי.ר | TEXT | PMI.R |
| פמי.מ | TEXT | PMI.M |
| ת.פתיחה | TEXT | Opening date |
| ת.עדכון | TEXT | Update date |
| ת.מה.ראשונה | TEXT | First edition date |
| created_at | TIMESTAMP | Record creation timestamp |

## Files Structure

```
website/
├── index.html          # Main HTML page
├── styles.css          # Styling
├── script.js           # Frontend JavaScript
├── server.py           # Flask backend server
├── requirements.txt    # Python dependencies
├── README.md           # This file
└── danalog_catalog.db  # SQLite database (created automatically)
```

## Technical Details

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Python Flask
- **Database:** SQLite3
- **Excel Processing:** pandas, openpyxl

## Future Enhancements (Based on Requirements)

The following features are planned for future implementation:

1. **Additional Book Fields Table**
   - Subtitle (כותרת משנה)
   - Translator (מתרגם)
   - Publisher (הוצאה לאור)
   - Year (שנה)
   - Page Count (מספר עמודים)
   - Binding (כריכה)
   - Size (גודל)
   - Series Name (שם סדרה)
   - Series Number (מספר בסדרה)

2. **Inventory Management**
   - Track multiple copies per book
   - Condition-based inventory (New, Excellent, Good, Average)
   - Price per condition

3. **Special Copy Items**
   - Individual pricing for special copies
   - Special notes
   - Condition notes (markings, glued spine, rust stains)

## Support

For questions or issues, please refer to the requirements document:
`Ayal Kore Requirements.txt`

## License

© 2026 Ayal Kore (The Reading Deer)
