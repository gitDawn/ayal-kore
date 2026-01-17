// Browser-only version using IndexedDB
// This version works on GitHub Pages without a backend server

const DB_NAME = 'AyalKoreCatalog';
const DB_VERSION = 2; // Upgraded for book details, inventory, and special copies
const STORE_NAME = 'danalog_catalog';

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;

            // Handle database connection close/error
            db.onclose = () => {
                console.warn('Database connection closed');
                db = null;
            };

            db.onerror = (event) => {
                console.error('Database error:', event);
            };

            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create main catalog store (version 1)
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

            // Create new stores for version 2
            if (event.oldVersion < 2) {
                // Book details store - additional book information
                if (!db.objectStoreNames.contains('book_details')) {
                    db.createObjectStore('book_details', { keyPath: 'bookId' });
                }

                // Inventory store - stock levels by condition
                if (!db.objectStoreNames.contains('inventory')) {
                    const inventoryStore = db.createObjectStore('inventory', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    inventoryStore.createIndex('bookId', 'bookId', { unique: false });
                }

                // Special copies store - individual special copies with unique pricing
                if (!db.objectStoreNames.contains('special_copies')) {
                    const specialStore = db.createObjectStore('special_copies', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    specialStore.createIndex('bookId', 'bookId', { unique: false });
                }
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

    // Ensure database is initialized
    if (!db) {
        showStatus(statusDiv, 'מאתחל מסד נתונים...', 'info');
        try {
            await initDB();
        } catch (error) {
            showStatus(statusDiv, `שגיאה באתחול מסד נתונים: ${error.message}`, 'error');
            return;
        }
    }

    const file = fileInput.files[0];

    try {
        showStatus(statusDiv, 'קורא קובץ Excel...', 'info');

        // Read Excel file using SheetJS
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 50000 }); // Limit to 50K rows to prevent memory issues

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON (only non-empty rows)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: null,
            blankrows: false  // Skip blank rows
        });

        showStatus(statusDiv, `טוען ${jsonData.length} רשומות...`, 'info');

        // First, get all existing danalog codes for fast duplicate checking
        showStatus(statusDiv, 'בודק רשומות קיימות...', 'info');
        const existingCodes = new Set();

        const readTransaction = db.transaction([STORE_NAME], 'readonly');
        const readStore = readTransaction.objectStore(STORE_NAME);
        const getAllRequest = readStore.getAll();

        const existingRecords = await new Promise((resolve) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
            getAllRequest.onerror = () => resolve([]);
        });

        existingRecords.forEach(record => {
            if (record['דאנאקוד']) {
                existingCodes.add(record['דאנאקוד']);
            }
        });

        showStatus(statusDiv, `מעבד ${jsonData.length} רשומות...`, 'info');

        // Filter out duplicates first
        const newRecords = jsonData.filter(row => {
            const code = row['דאנאקוד'];
            return !code || !existingCodes.has(code);
        });

        const skipped = jsonData.length - newRecords.length;
        let added = 0;

        // Process new records in batches
        const BATCH_SIZE = 100; // Larger batches for better performance

        for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
            const batch = newRecords.slice(i, Math.min(i + BATCH_SIZE, newRecords.length));

            // Add batch to database
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const objectStore = transaction.objectStore(STORE_NAME);

            for (const row of batch) {
                objectStore.add(row);
            }

            // Wait for transaction to complete
            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => {
                    added += batch.length;
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            });

            // Update progress
            const progress = Math.round((added / newRecords.length) * 100);
            showStatus(statusDiv,
                `מעבד ${added} מתוך ${newRecords.length} רשומות חדשות (${progress}%)...`,
                'info');

            // Yield to browser to keep it responsive
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Get total count
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
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

    // Ensure database is initialized
    if (!db) {
        showStatus(statusDiv, 'מסד הנתונים לא מאותחל. אנא רענן את הדף.', 'error');
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

// Helper function to format date fields
function formatDateField(value, fieldName) {
    // Date fields that need formatting
    const dateFields = ['ת.פתיחה', 'ת.עדכון', 'ת.מה.ראשונה'];

    if (!dateFields.includes(fieldName)) {
        return value;
    }

    if (!value) return '';

    try {
        // Handle Excel date serial numbers
        if (typeof value === 'number') {
            // Excel date: days since 1900-01-01
            const excelEpoch = new Date(1899, 11, 30); // Excel's epoch
            const date = new Date(excelEpoch.getTime() + value * 86400000);
            return date.toLocaleDateString('he-IL');
        }

        // Handle date strings
        if (typeof value === 'string') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('he-IL');
            }
        }

        // Return as-is if can't parse
        return value;
    } catch (error) {
        return value;
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
    html += '<th>פעולות</th>'; // Actions column

    html += '</tr></thead><tbody>';

    // Table rows
    results.forEach(row => {
        html += '<tr>';
        displayFields.forEach(field => {
            let value = row[field] !== null && row[field] !== undefined ? row[field] : '';

            // Format date fields
            value = formatDateField(value, field);

            html += `<td>${value}</td>`;
        });

        // Add edit button
        html += `<td><button onclick="openBookEditor(${row.ID})" style="padding: 8px 16px; font-size: 0.9em;">ערוך</button></td>`;

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

// ========================================
// Book Editor Modal Functions
// ========================================

let currentBookId = null;

// Open book editor modal
async function openBookEditor(bookId) {
    currentBookId = bookId;

    try {
        // Load book data
        const book = await getBookById(bookId);
        const details = await getBookDetails(bookId);
        const inventory = await getInventory(bookId);
        const specialCopies = await getSpecialCopies(bookId);

        // Populate modal header
        document.getElementById('modal-book-name').textContent = book.שם || 'ללא שם';
        document.getElementById('modal-book-id').textContent = book.ID;
        document.getElementById('modal-danalog-code').textContent = book.דאנאקוד || 'ללא קוד';

        // Populate tabs
        populateDetailsForm(details);
        populateInventoryList(inventory);
        populateSpecialCopiesList(specialCopies);

        // Show modal and activate first tab
        document.getElementById('book-editor-modal').style.display = 'block';
        showTab('details');

    } catch (error) {
        alert(`שגיאה בטעינת נתוני ספר: ${error.message}`);
        console.error(error);
    }
}

// Close book editor modal
function closeBookEditor() {
    document.getElementById('book-editor-modal').style.display = 'none';
    currentBookId = null;
}

// Switch between tabs
function showTab(tabName, event) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('book-editor-modal');
    if (event.target === modal) {
        closeBookEditor();
    }
};

// ========================================
// Data Retrieval Functions
// ========================================

// Get book by ID from main catalog
async function getBookById(id) {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result);
            } else {
                reject(new Error('ספר לא נמצא'));
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Get book details (additional fields)
async function getBookDetails(bookId) {
    const transaction = db.transaction(['book_details'], 'readonly');
    const store = transaction.objectStore('book_details');
    const request = store.get(bookId);

    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || {});
        request.onerror = () => resolve({});
    });
}

// Get inventory for a book
async function getInventory(bookId) {
    const transaction = db.transaction(['inventory'], 'readonly');
    const store = transaction.objectStore('inventory');
    const index = store.index('bookId');
    const request = index.getAll(bookId);

    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// Get special copies for a book
async function getSpecialCopies(bookId) {
    const transaction = db.transaction(['special_copies'], 'readonly');
    const store = transaction.objectStore('special_copies');
    const index = store.index('bookId');
    const request = index.getAll(bookId);

    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// ========================================
// Details Form Functions
// ========================================

// Populate details form with existing data
function populateDetailsForm(details) {
    const form = document.getElementById('details-form');

    form.elements['subtitle'].value = details.כותרת_משנה || '';
    form.elements['translator'].value = details.מתרגם || '';
    form.elements['publisher'].value = details.הוצאה_לאור || '';
    form.elements['year'].value = details.שנה || '';
    form.elements['pages'].value = details.מספר_עמודים || '';
    form.elements['binding'].value = details.כריכה || '';
    form.elements['size'].value = details.גודל || '';
    form.elements['series_name'].value = details.שם_סדרה || '';
    form.elements['number_in_series'].value = details.מספר_בסדרה || '';
}

// Save book details
async function saveBookDetails(bookId) {
    const form = document.getElementById('details-form');

    const details = {
        bookId: bookId,
        כותרת_משנה: form.elements['subtitle'].value.trim(),
        מתרגם: form.elements['translator'].value.trim(),
        הוצאה_לאור: form.elements['publisher'].value.trim(),
        שנה: form.elements['year'].value ? parseInt(form.elements['year'].value) : null,
        מספר_עמודים: form.elements['pages'].value ? parseInt(form.elements['pages'].value) : null,
        כריכה: form.elements['binding'].value.trim(),
        גודל: form.elements['size'].value.trim(),
        שם_סדרה: form.elements['series_name'].value.trim(),
        מספר_בסדרה: form.elements['number_in_series'].value ? parseInt(form.elements['number_in_series'].value) : null
    };

    const transaction = db.transaction(['book_details'], 'readwrite');
    const store = transaction.objectStore('book_details');

    return new Promise((resolve, reject) => {
        const request = store.put(details);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ========================================
// Inventory Management Functions
// ========================================

// Populate inventory list
function populateInventoryList(inventory) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';

    inventory.forEach((item, index) => {
        const rowId = `existing-${index}`;
        addInventoryRow(rowId, item.מצב, item.כמות, item.מחיר);
    });

    // Add one empty row if there's no inventory
    if (inventory.length === 0) {
        addInventoryRow();
    }
}

// Add inventory row
function addInventoryRow(rowId = null, condition = '', quantity = '', price = '') {
    const container = document.getElementById('inventory-list');
    const id = rowId || `new-${Date.now()}`;

    const rowHtml = `
        <div class="inventory-row" data-row-id="${id}">
            <select name="condition-${id}">
                <option value="">-- בחר מצב --</option>
                <option value="חדש" ${condition === 'חדש' ? 'selected' : ''}>חדש</option>
                <option value="מצוין / כחדש" ${condition === 'מצוין / כחדש' ? 'selected' : ''}>מצוין / כחדש</option>
                <option value="טוב" ${condition === 'טוב' ? 'selected' : ''}>טוב</option>
                <option value="בינוני" ${condition === 'בינוני' ? 'selected' : ''}>בינוני</option>
            </select>
            <input type="number" name="quantity-${id}" placeholder="כמות" min="0" value="${quantity}" />
            <input type="number" name="price-${id}" placeholder="מחיר" step="0.01" min="0" value="${price}" />
            <button onclick="removeInventoryRow('${id}')">מחק</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', rowHtml);
}

// Remove inventory row
function removeInventoryRow(rowId) {
    const row = document.querySelector(`[data-row-id="${rowId}"]`);
    if (row) row.remove();
}

// Save inventory
async function saveInventory(bookId) {
    const transaction = db.transaction(['inventory'], 'readwrite');
    const store = transaction.objectStore('inventory');
    const index = store.index('bookId');

    // Delete existing inventory for this book
    const existing = await new Promise((resolve) => {
        const request = index.getAll(bookId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });

    for (const item of existing) {
        await new Promise((resolve) => {
            const request = store.delete(item.id);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }

    // Add new inventory rows
    const rows = document.querySelectorAll('.inventory-row');
    for (const row of rows) {
        const rowId = row.dataset.rowId;
        const condition = row.querySelector(`[name="condition-${rowId}"]`).value;
        const quantity = parseInt(row.querySelector(`[name="quantity-${rowId}"]`).value) || 0;
        const price = parseFloat(row.querySelector(`[name="price-${rowId}"]`).value) || 0;

        if (condition && quantity > 0) {
            await new Promise((resolve, reject) => {
                const request = store.add({
                    bookId: bookId,
                    מצב: condition,
                    כמות: quantity,
                    מחיר: price
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
}

// ========================================
// Special Copies Management Functions
// ========================================

// Populate special copies list
function populateSpecialCopiesList(specialCopies) {
    const container = document.getElementById('special-copies-list');
    container.innerHTML = '';

    specialCopies.forEach((copy, index) => {
        const copyId = `existing-${index}`;
        addSpecialCopy(copyId, copy.מחיר, copy.הערות_מיוחדות, copy.condition_notes || []);
    });

    // Add empty message if no special copies
    if (specialCopies.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">אין עותקים מיוחדים. לחץ "הוסף עותק מיוחד" להוספה.</p>';
    }
}

// Add special copy
function addSpecialCopy(copyId = null, price = '', notes = '', conditionNotes = []) {
    const container = document.getElementById('special-copies-list');
    const id = copyId || `new-${Date.now()}`;

    // Remove empty message if it exists
    const emptyMsg = container.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const hasMarkings = conditionNotes.includes('סימונים / מרקורים');
    const hasSpine = conditionNotes.includes('שדרה מודבקת');
    const hasRust = conditionNotes.includes('כתמי חלודה');

    const rowHtml = `
        <div class="special-copy-row" data-copy-id="${id}">
            <h4>עותק מיוחד</h4>
            <label>
                מחיר:
                <input type="number" name="special-price-${id}" step="0.01" min="0" value="${price}" />
            </label>
            <label>
                הערות מיוחדות:
                <textarea name="special-notes-${id}">${notes}</textarea>
            </label>
            <fieldset>
                <legend>הערות על מצב הספר:</legend>
                <label><input type="checkbox" name="condition-markings-${id}" ${hasMarkings ? 'checked' : ''} /> סימונים / מרקורים</label>
                <label><input type="checkbox" name="condition-spine-${id}" ${hasSpine ? 'checked' : ''} /> שדרה מודבקת</label>
                <label><input type="checkbox" name="condition-rust-${id}" ${hasRust ? 'checked' : ''} /> כתמי חלודה</label>
            </fieldset>
            <button onclick="removeSpecialCopy('${id}')">מחק עותק</button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', rowHtml);
}

// Remove special copy
function removeSpecialCopy(copyId) {
    const row = document.querySelector(`[data-copy-id="${copyId}"]`);
    if (row) row.remove();

    // Show empty message if no copies left
    const container = document.getElementById('special-copies-list');
    if (container.children.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">אין עותקים מיוחדים. לחץ "הוסף עותק מיוחד" להוספה.</p>';
    }
}

// Save special copies
async function saveSpecialCopies(bookId) {
    const transaction = db.transaction(['special_copies'], 'readwrite');
    const store = transaction.objectStore('special_copies');
    const index = store.index('bookId');

    // Delete existing special copies
    const existing = await new Promise((resolve) => {
        const request = index.getAll(bookId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });

    for (const item of existing) {
        await new Promise((resolve) => {
            const request = store.delete(item.id);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }

    // Add new special copies
    const rows = document.querySelectorAll('.special-copy-row');
    for (const row of rows) {
        const copyId = row.dataset.copyId;
        const price = parseFloat(row.querySelector(`[name="special-price-${copyId}"]`).value) || 0;
        const notes = row.querySelector(`[name="special-notes-${copyId}"]`).value.trim();

        const conditionNotes = [];
        if (row.querySelector(`[name="condition-markings-${copyId}"]`).checked) {
            conditionNotes.push('סימונים / מרקורים');
        }
        if (row.querySelector(`[name="condition-spine-${copyId}"]`).checked) {
            conditionNotes.push('שדרה מודבקת');
        }
        if (row.querySelector(`[name="condition-rust-${copyId}"]`).checked) {
            conditionNotes.push('כתמי חלודה');
        }

        if (price > 0 || notes || conditionNotes.length > 0) {
            await new Promise((resolve, reject) => {
                const request = store.add({
                    bookId: bookId,
                    מחיר: price,
                    הערות_מיוחדות: notes,
                    condition_notes: conditionNotes
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
}

// ========================================
// Save All Book Data
// ========================================

async function saveBookData() {
    if (!currentBookId) {
        alert('שגיאה: לא נבחר ספר');
        return;
    }

    try {
        // Save all three sections
        await saveBookDetails(currentBookId);
        await saveInventory(currentBookId);
        await saveSpecialCopies(currentBookId);

        alert('הנתונים נשמרו בהצלחה!');
        closeBookEditor();

    } catch (error) {
        alert(`שגיאה בשמירת נתונים: ${error.message}`);
        console.error(error);
    }
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
