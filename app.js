// Browser-only version using IndexedDB
// This version works on GitHub Pages without a backend server

const DB_NAME = 'AyalKoreCatalog';
const DB_VERSION = 1;
const STORE_NAME = 'danalog_catalog';

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, {
                    keyPath: 'ID',
                    autoIncrement: true
                });

                // Create indexes for faster searching
                objectStore.createIndex('דאנאקוד', 'דאנאקוד', { unique: false });
                objectStore.createIndex('שם', 'שם', { unique: false });
                objectStore.createIndex('מחבר', 'מחבר', { unique: false });
                objectStore.createIndex('נושא', 'נושא', { unique: false });
            }
        };
    });
}

// Upload and process Excel file
async function uploadDanalog() {
    const fileInput = document.getElementById('excel-file');
    const statusDiv = document.getElementById('upload-status');

    if (!fileInput.files || fileInput.files.length === 0) {
        showStatus(statusDiv, 'אנא בחר קובץ Excel להעלאה', 'error');
        return;
    }

    const file = fileInput.files[0];

    try {
        showStatus(statusDiv, 'קורא קובץ Excel...', 'info');

        // Read Excel file using SheetJS
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        showStatus(statusDiv, `מעבד ${jsonData.length} רשומות...`, 'info');

        // Add records to IndexedDB
        let added = 0;
        let skipped = 0;

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        for (const row of jsonData) {
            const danalogCode = row['דאנאקוד'];

            // Check if record already exists
            if (danalogCode) {
                const index = objectStore.index('דאנאקוד');
                const existingRequest = index.get(danalogCode);

                const exists = await new Promise((resolve) => {
                    existingRequest.onsuccess = () => resolve(existingRequest.result);
                    existingRequest.onerror = () => resolve(null);
                });

                if (exists) {
                    skipped++;
                    continue;
                }
            }

            // Add new record (ID will be auto-generated)
            const addRequest = objectStore.add(row);
            await new Promise((resolve, reject) => {
                addRequest.onsuccess = () => {
                    added++;
                    resolve();
                };
                addRequest.onerror = () => reject(addRequest.error);
            });
        }

        // Get total count
        const countRequest = objectStore.count();
        const total = await new Promise((resolve) => {
            countRequest.onsuccess = () => resolve(countRequest.result);
        });

        showStatus(statusDiv,
            `הקובץ הועלה בהצלחה! נוספו ${added} רשומות חדשות, דולגו ${skipped} רשומות קיימות. סה"כ רשומות: ${total}`,
            'success');

        // Reload stats
        loadStats();

    } catch (error) {
        showStatus(statusDiv, `שגיאה: ${error.message}`, 'error');
        console.error(error);
    }
}

// Search catalog
async function searchCatalog() {
    const column = document.getElementById('search-column').value;
    const searchText = document.getElementById('search-text').value;
    const statusDiv = document.getElementById('search-status');
    const resultsTitle = document.getElementById('results-title');
    const resultsTable = document.getElementById('results-table');

    if (!column) {
        showStatus(statusDiv, 'אנא בחר שדה לחיפוש', 'error');
        return;
    }

    if (!searchText.trim()) {
        showStatus(statusDiv, 'אנא הזן טקסט לחיפוש', 'error');
        return;
    }

    try {
        showStatus(statusDiv, 'מחפש...', 'info');

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);

        // Get all records and filter
        const getAllRequest = objectStore.getAll();

        const allRecords = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        // Filter records based on search criteria
        const searchTextLower = searchText.toLowerCase();
        const results = allRecords.filter(record => {
            const fieldValue = record[column];
            if (fieldValue === null || fieldValue === undefined) return false;
            return String(fieldValue).toLowerCase().includes(searchTextLower);
        });

        if (results.length === 0) {
            showStatus(statusDiv, 'לא נמצאו תוצאות', 'info');
            resultsTitle.style.display = 'none';
            resultsTable.innerHTML = '';
        } else {
            showStatus(statusDiv, `נמצאו ${results.length} תוצאות`, 'success');
            displayResults(results);
        }

    } catch (error) {
        showStatus(statusDiv, `שגיאה בחיפוש: ${error.message}`, 'error');
        console.error(error);
    }
}

// Display search results in table
function displayResults(results) {
    const resultsTitle = document.getElementById('results-title');
    const resultsTable = document.getElementById('results-table');

    resultsTitle.style.display = 'block';

    // Fields to display (excluding the unimportant ones from requirements)
    const displayFields = [
        'ID',
        'דאנאקוד',
        'שם',
        'ת.מחלקה',
        'מחיר',
        'מחבר',
        'נושא',
        'ברקוד',
        'ת.פתיחה',
        'ת.עדכון',
        'ת.מה.ראשונה'
    ];

    let html = '<table><thead><tr>';

    // Table headers
    displayFields.forEach(field => {
        html += `<th>${field}</th>`;
    });

    html += '</tr></thead><tbody>';

    // Table rows
    results.forEach(row => {
        html += '<tr>';
        displayFields.forEach(field => {
            const value = row[field] !== null && row[field] !== undefined ? row[field] : '';
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    resultsTable.innerHTML = html;
}

// Load database statistics
async function loadStats() {
    const statsDisplay = document.getElementById('stats-display');

    try {
        if (!db) {
            statsDisplay.innerHTML = '<p>מאתחל מסד נתונים...</p>';
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const countRequest = objectStore.count();

        const count = await new Promise((resolve, reject) => {
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
        });

        let html = `
            <div class="stat-card">
                <h3>סה"כ ספרים</h3>
                <div class="stat-value">${count}</div>
            </div>
            <div class="stat-card">
                <h3>סטטוס מסד נתונים</h3>
                <div class="stat-value">${count > 0 ? '✓' : '○'}</div>
            </div>
        `;

        statsDisplay.innerHTML = html;

    } catch (error) {
        statsDisplay.innerHTML = `<p>שגיאה: ${error.message}</p>`;
        console.error(error);
    }
}

// Export database to JSON
async function exportDatabase() {
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const getAllRequest = objectStore.getAll();

        const allRecords = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        // Create JSON blob
        const jsonStr = JSON.stringify(allRecords, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });

        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ayal-kore-catalog-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`הורדו ${allRecords.length} רשומות בהצלחה`);

    } catch (error) {
        alert(`שגיאה בייצוא: ${error.message}`);
        console.error(error);
    }
}

// Clear all data
async function clearDatabase() {
    if (!confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים? פעולה זו אינה ניתנת לביטול!')) {
        return;
    }

    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const clearRequest = objectStore.clear();

        await new Promise((resolve, reject) => {
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });

        alert('כל הנתונים נמחקו בהצלחה');
        loadStats();

    } catch (error) {
        alert(`שגיאה במחיקה: ${error.message}`);
        console.error(error);
    }
}

// Helper function to show status messages
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        console.log('IndexedDB initialized successfully');
        loadStats();
    } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        alert('שגיאה באתחול מסד הנתונים. אנא נסה לרענן את הדף.');
    }
});
