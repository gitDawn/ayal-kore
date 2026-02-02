# Ayal Kore (האיל הקורא) - Book Catalog System Requirements

## 1. General Description

### 1.1 Overview

**Ayal Kore** (האיל הקורא - "The Reading Deer") is a web-based book catalog management system designed for a second-hand bookstore. The system manages an inventory of used books from the Danalog catalog system with cloud storage capabilities.

### 1.2 Purpose

The system serves as a database for used books stored in the bookstore's warehouse. It provides:

- Storage and management of book catalog data
- Search functionality for finding books
- Inventory tracking by book condition
- Support for special/unique book copies with individual pricing

### 1.3 Repository and Deployment

| Resource | Location |
|----------|----------|
| Local Development | `C:\Users\user\Google Drive Streaming\My Drive\Work\Simania Eyal\Ayal_Kore\` |
| GitHub Repository | https://github.com/gitDawn/ayal-kore |
| Live Website | https://gitdawn.github.io/ayal-kore/ |
| Backend API | https://ayal-kore.onrender.com |

---

## 2. System Architecture

### 2.1 Deployment Options

The system supports deployment configurations:

#### Option A: Full Stack (Flask + MongoDB)

- **Frontend**: GitHub Pages
- **Backend**: Python Flask on Render
- **Database**: MongoDB Atlas (cloud)
- **Benefits**: Centralized data, multi-user support, data persistence

### 2.2 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, JavaScript (ES6) |
| Excel Processing | SheetJS (XLSX) library |
| Backend | Python Flask |
| Database | MongoDB Atlas |
| Server | Gunicorn |
| Libraries | Pandas, OpenPyXL, Flask-CORS, PyMongo |

---

## 3. Database Schema

### 3.1 Danalog Catalog Table (Primary)

The main catalog imported from Danalog Excel files contains the following columns:

| Hebrew Field | English Name | Type | Description |
|--------------|--------------|------|-------------|
| ID | Internal ID | INTEGER | Auto-generated unique identifier (primary key) |
| ש.לפריט | Item Serial | TEXT | Item serial number from Danalog |
| דאנאקוד | Danalog Code | TEXT | Unique Danalog identifier |
| שם | Name/Title | TEXT | Book title |
| ק.מחלקה | Department Code | TEXT | Department code |
| ת.מחלקה | Department Desc | TEXT | Department description/category |
| מחיר | Price | REAL | Standard price |
| מ.מיוחד | Special Price | REAL | Special price variant |
| מ.מיוחד1 | Special Price 1 | REAL | Additional special price |
| לימוד | Educational | TEXT | Educational/study flag |
| מאושר | Approved | TEXT | Approval status |
| ק.יצרן | Manufacturer Code | TEXT | Manufacturer/publisher code |
| יצרן | Manufacturer | TEXT | Manufacturer/publisher name |
| ק.מחבר | Author Code | TEXT | Author code |
| מחבר | Author | TEXT | Author name |
| ק.נושא | Subject Code | TEXT | Subject/category code |
| נושא | Subject | TEXT | Subject/category description |
| אזל | Out of Stock | TEXT | Out of stock flag |
| ברקוד | Barcode | TEXT | Primary barcode |
| ברקוד-נ | Barcode-N | TEXT | Alternative barcode |
| פמי.ר | PMI.R | TEXT | PMI.R metadata |
| פמי.מ | PMI.M | TEXT | PMI.M metadata |
| ת.פתיחה | Opening Date | DATE | Record creation date |
| ת.עדכון | Update Date | DATE | Last update date |
| ת.מה.ראשונה | First Edition | DATE | First edition date |

**Note**: Date fields (ת.פתיחה, ת.עדכון, ת.מה.ראשונה) must be displayed in proper date format.

### 3.2 Internal ID System

Each book in the catalog receives a unique internal ID (`ID` field) which:

- Serves as the book's unique identifier across all tables
- Enables linking additional data tables to the main catalog
- Allows adding books that don't have a Danalog code (old books without barcodes)
- Must be unique and never reused

### 3.3 Inventory Table

Tracks copies of each book by condition. Structure:

| Field | Type | Description |
|-------|------|-------------|
| Internal ID | INTEGER | Links to main catalog (foreign key) |
| Condition | TEXT | Book condition (see 3.4) |
| Quantity | INTEGER | Number of copies in this condition |
| Price | REAL | Price for copies in this condition |

**Example Record**:

```
Internal ID: 1053
Condition: Good     | Quantity: 3 | Price: 20
Condition: Fair     | Quantity: 1 | Price: 10
```

**Note**: Price is uniform for all copies of the same book in the same condition.

### 3.4 Book Conditions

Available book conditions (stored in a separate lookup table for extensibility):

| Hebrew | English |
|--------|---------|
| חדש | New |
| מצוין / כחדש | Excellent / Like New |
| טוב | Good |
| בינוני | Fair |

Conditions should be selectable via dropdown menu during cataloging.

### 3.5 Additional Book Fields Table

Extended metadata linked by Internal ID:

| Hebrew Field | English Name | Type | Description |
|--------------|--------------|------|-------------|
| מספר סידורי פנימי | Internal ID | INTEGER | Links to main catalog |
| כותרת משנה | Subtitle | TEXT | Book subtitle |
| מתרגם | Translator | TEXT | Translator name |
| הוצאה לאור | Publisher | TEXT | Publishing house |
| שנה | Year | TEXT | Publication year |
| מספר עמודים | Page Count | INTEGER | Number of pages |
| כריכה | Binding | TEXT | Binding type |
| גודל | Size | TEXT | Physical dimensions |
| שם סדרה | Series Name | TEXT | Series title |
| מספר בסדרה | Series Number | TEXT | Position in series |

### 3.6 Special Copies Table

For unique/special book copies with individual pricing:

| Hebrew Field | English Name | Type | Description |
|--------------|--------------|------|-------------|
| מספר סידורי פנימי | Internal ID | INTEGER | Links to main catalog |
| מחיר | Price | REAL | Individual copy price |
| הערות מיוחדות | Special Notes | TEXT | Free-text special notes |
| הערות על מצב הספר | Condition Notes | TEXT | Condition markers (see 3.7) |

### 3.7 Book Condition Notes

Checkbox-style condition markers (multiple selections allowed):

| Hebrew | English |
|--------|---------|
| סימונים / מרקורים | Markings / Highlighters |
| שדרה מודבקת | Glued Spine |
| כתמי חלודה | Rust Stains |

These are selectable via checkboxes and stored as a combined field.

---

## 4. Website Structure & UI

### 4.1 General Requirements

- **Language**: Hebrew (RTL - Right-to-Left layout)
- **Encoding**: UTF-8
- **Responsive**: Desktop-first, mobile-friendly
- **Direction**: `dir="rtl"` and `lang="he"` attributes

### 4.2 Page Sections

#### 4.2.1 Header

- Site title: "קטלוג ספרים - האיל הקורא"
- Help link to user documentation

#### 4.2.2 Catalog Upload Section

- File input for Excel files (.xlsx, .xls)
- "Upload Catalog" (העלה קטלוג) button
- Status message display area

#### 4.2.3 Search Section

- Dropdown for selecting search field
- Text input for search query
- "Search" (חפש) button
- Searchable fields:
  - דאנאקוד (Danalog Code)
  - שם (Name)
  - ת.מחלקה (Department)
  - מחיר (Price)
  - מחבר (Author)
  - נושא (Subject)
  - ברקוד (Barcode)
  - ת.פתיחה (Opening Date)
  - ת.עדכון (Update Date)
  - ת.מה.ראשונה (First Edition)

#### 4.2.4 Search Results Section

- Table displaying matching records
- Limited to 5 visible results with vertical scroll
- Horizontal scroll for wide content

#### 4.2.5 Statistics Section

- "Load Statistics" button
- Display total books count

#### 4.2.6 Database Management Section

- Export to JSON button
- Clear database button (with confirmation)
- Backup recommendation notice

#### 4.2.7 Book Editor Modal

Popup dialog for editing book details with:

- All fields from Additional Book Fields table
- Inventory management (condition/quantity/price)
- Special copy notation
- Save/Cancel/Add buttons

---

## 5. Functional Requirements

### 5.1 Catalog Upload

#### 5.1.1 Initial Upload (Empty Database)

1. User selects Excel file via browser
2. System reads file using SheetJS/Pandas
3. Each row becomes a new record
4. System assigns unique `ID` to each record
5. Records are inserted into database
6. Success message shows count of added records

#### 5.1.2 Subsequent Uploads (Existing Database)

1. User selects Excel file
2. System reads file
3. For each row:
   - Check if `דאנאקוד` already exists in database
   - If exists: **skip** (do not update)
   - If not exists: **add** with new unique `ID`
4. Success message shows: added count, skipped count, total count

#### 5.1.3 Upload Constraints

- Supported formats: `.xlsx`, `.xls`
- Large file support: 300,000+ rows
- Timeout: Extended to handle large files (120+ seconds)
- Memory optimization for large catalogs

### 5.2 Search Functionality

#### 5.2.1 Search Process

1. User selects field from dropdown
2. User enters search text
3. User clicks "Search" button
4. System performs partial match search (case-insensitive)
5. Results displayed in table format

#### 5.2.2 Results Display

- Maximum 5 results visible at once
- Vertical scrollbar for additional results
- Results sorted by relevance/match

### 5.3 Display Rules

#### 5.3.1 Fields to Display in Search Results

| Field | Display |
|-------|---------|
| ID | Yes |
| דאנאקוד | Yes |
| שם | Yes |
| ת.מחלקה | Yes |
| מחיר | Yes |
| מחבר | Yes |
| נושא | Yes |
| ברקוד | Yes |
| ת.פתיחה | Yes |
| ת.עדכון | Yes |
| ת.מה.ראשונה | Yes |

#### 5.3.2 Fields Hidden from Search Results

The following fields are NOT displayed to users:

- ש.לפריט (Item Serial)
- ק.מחלקה (Department Code)
- מ.מיוחד (Special Price)
- מ.מיוחד1 (Special Price 1)
- לימוד (Educational)
- מאושר (Approved)
- ק.יצרן (Manufacturer Code)
- יצרן (Manufacturer)
- ק.מחבר (Author Code)
- ק.נושא (Subject Code)
- אזל (Out of Stock)
- ברקוד-נ (Barcode-N)
- פמי.ר (PMI.R)
- פמי.מ (PMI.M)

### 5.4 Inventory Management

#### 5.4.1 Adding Inventory

1. Search for book in catalog
2. Open book editor
3. Select condition from dropdown
4. Enter quantity
5. Enter price for this condition
6. Save changes

#### 5.4.2 Inventory Rules

- Each book can have multiple condition entries
- Each condition has its own price
- Price applies to all copies of same condition
- Quantities are updated manually

### 5.5 Special Copies

#### 5.5.1 Adding Special Copies

1. Search for book in catalog
2. Open book editor
3. Navigate to "Special Copies" section
4. Enter individual price
5. Add special notes
6. Select condition notes (checkboxes)
7. Save

#### 5.5.2 Special Copy Rules

- Each special copy has individual pricing
- Multiple condition notes can be selected
- Free-text notes field available

### 5.6 Data Export/Import

#### 5.6.1 Export

- Export entire database to JSON format
- Download as file

#### 5.6.2 Clear Database

- Requires confirmation dialog
- Deletes all records
- Backup reminder shown before action

---

## 6. API Endpoints (Backend)

### 6.1 Upload Catalog

```
POST /upload
Content-Type: multipart/form-data

Request: Excel file
Response: {
  "success": true,
  "added": 100,
  "skipped": 50,
  "total": 5000
}
```

### 6.2 Search

```
GET /search?column={field}&text={query}

Response: {
  "success": true,
  "results": [...],
  "count": 25
}
```

### 6.3 Statistics

```
GET /stats

Response: {
  "database_exists": true,
  "total_books": 5000
}
```

### 6.4 Health Check

```
GET /

Response: {
  "status": "running",
  "message": "Ayal Kore Catalog API"
}
```

---

## 7. Implementation Status

### 7.1 Implemented Features

| Feature | Status |
|---------|--------|
| Excel catalog upload (300K+ rows) | ✅ |
| Smart duplicate detection by דאנאקוד | ✅ |
| Multi-field search with partial matching | ✅ |
| Database statistics display | ✅ |
| JSON export | ✅ |
| Responsive RTL Hebrew UI | ✅ |
| Cloud database (MongoDB Atlas) | ✅ |
| Multi-user support | ✅ |
| Batch operation optimization | ✅ |
| Help documentation | ✅ |

### 7.2 Planned Features (Future)

| Feature | Status |
|---------|--------|
| Inventory management (quantity by condition) | 🔲 |
| Special copy items with unique pricing | 🔲 |
| Additional book fields table | 🔲 |
| Book condition notes (checkboxes) | 🔲 |
| Edit/update records via UI | 🔲 |
| User authentication | 🔲 |
| Advanced search (multiple fields) | 🔲 |
| Book images | 🔲 |

---

## 8. User Interface Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  קטלוג ספרים - האיל הקורא                          [עזרה]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ העלאת קטלוג ─────────────────────────────────────────┐ │
│  │  [בחר קובץ Excel]              [העלה קטלוג]           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ חיפוש ───────────────────────────────────────────────┐ │
│  │  [▼ בחר שדה]  [________________]  [חפש]              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ תוצאות חיפוש ────────────────────────────────────────┐ │
│  │  דאנאקוד │ שם      │ מחבר    │ נושא   │ מחיר │ ברקוד  │ │
│  │  ────────┼─────────┼─────────┼────────┼──────┼─────── │ │
│  │  12345   │ ספר א   │ סופר א  │ בדיוני │ 30   │ 978... │ │
│  │  12346   │ ספר ב   │ סופר ב  │ היסטו  │ 25   │ 978... │ │
│  │  ... (scroll for more)                                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ סטטיסטיקות ──────────────────────────────────────────┐ │
│  │  [טען סטטיסטיקות]    סה"כ ספרים: 5,000                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ ניהול מסד נתונים ────────────────────────────────────┐ │
│  │  [יצוא JSON]                      │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  © 2026 האיל הקורא                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Glossary

| Term | Hebrew | Description |
|------|--------|-------------|
| Danalog | דאנאקוד | External catalog system used as data source |
| Internal ID | מספר סידורי פנימי | Unique identifier assigned by the system |
| Condition | מצב | Physical state of a book copy |
| Special Copy | עותק מיוחד | Unique copy with individual pricing |
| RTL | ימין לשמאל | Right-to-left text direction |

---

*Document Version: 1.0*
*Last Updated: February 2026*
