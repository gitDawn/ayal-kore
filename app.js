// API-based version for online database
// This version connects to the Flask backend server

const API_BASE_URL = 'https://ayal-kore.onrender.com';

// Current book being edited
let currentBookId = null;

// Book conditions for dropdown
const BOOK_CONDITIONS = ['חדש', 'מצוין / כחדש', 'טוב', 'בינוני'];

// Condition notes for checkboxes
const CONDITION_NOTES = ['סימונים / מרקורים', 'שדרה מודבקת', 'כתמי חלודה'];

// ========================================
// Upload Functions
// ========================================

async function uploadDanalog() {
    const fileInput = document.getElementById('excel-file');
    const statusDiv = document.getElementById('upload-status');

    if (!fileInput.files || fileInput.files.length === 0) {
        showStatus(statusDiv, 'אנא בחר קובץ Excel להעלאה', 'error');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    showStatus(statusDiv, 'מעלה קובץ...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showStatus(statusDiv,
                `העלאה הושלמה! נוספו ${result.added} ספרים, דולגו ${result.skipped} (כפולים). סה"כ: ${result.total}`,
                'success'
            );
            updateStats();
        } else {
            showStatus(statusDiv, `שגיאה: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(statusDiv, `שגיאה ברשת: ${error.message}`, 'error');
    }
}

// ========================================
// Search Functions
// ========================================

async function searchCatalog() {
    const columnSelect = document.getElementById('search-column');
    const searchInput = document.getElementById('search-text');
    const statusDiv = document.getElementById('search-status');
    const resultsDiv = document.getElementById('results-table');
    const resultsTitle = document.getElementById('results-title');

    const column = columnSelect.value;
    const searchText = searchInput.value.trim();

    if (!column || !searchText) {
        showStatus(statusDiv, 'אנא בחר שדה וזן טקסט לחיפוש', 'error');
        return;
    }

    showStatus(statusDiv, 'מחפש...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/search?column=${encodeURIComponent(column)}&text=${encodeURIComponent(searchText)}`);
        const result = await response.json();

        if (result.success) {
            displaySearchResults(result.results, resultsDiv);
            if (resultsTitle) resultsTitle.style.display = 'block';
            showStatus(statusDiv, `נמצאו ${result.count} תוצאות`, 'success');
        } else {
            showStatus(statusDiv, `שגיאה: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(statusDiv, `שגיאה ברשת: ${error.message}`, 'error');
    }
}

function displaySearchResults(results, resultsDiv) {
    if (!resultsDiv) {
        resultsDiv = document.getElementById('results-table');
    }

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p>לא נמצאו תוצאות</p>';
        return;
    }

    let html = '<table class="results-table">';
    html += '<thead><tr>';
    html += '<th>פעולות</th>';
    html += '<th>דאנאקוד</th>';
    html += '<th>שם הספר</th>';
    html += '<th>מחבר</th>';
    html += '<th>נושא</th>';
    html += '<th>מחיר</th>';
    html += '<th>ברקוד</th>';
    html += '</tr></thead><tbody>';

    results.forEach(book => {
        const bookId = book['_id'] || '';
        const bookName = book['שם'] || '';
        const danalogCode = book['דאנאקוד'] || '';

        html += '<tr>';
        html += `<td><button class="edit-btn" onclick="openBookEditor('${bookId}', '${escapeHtml(bookName)}', '${escapeHtml(danalogCode)}')">ערוך</button></td>`;
        html += `<td>${danalogCode}</td>`;
        html += `<td>${bookName}</td>`;
        html += `<td>${book['מחבר'] || ''}</td>`;
        html += `<td>${book['נושא'] || ''}</td>`;
        html += `<td>${book['מחיר'] || ''}</td>`;
        html += `<td>${book['ברקוד'] || ''}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ========================================
// Modal Functions
// ========================================

async function openBookEditor(bookId, bookName, danalogCode) {
    currentBookId = bookId;

    // Set modal header info
    document.getElementById('modal-book-name').textContent = bookName;
    document.getElementById('modal-book-id').textContent = bookId;
    document.getElementById('modal-danalog-code').textContent = danalogCode;

    // Reset form
    document.getElementById('details-form').reset();
    document.getElementById('inventory-list').innerHTML = '';
    document.getElementById('special-copies-list').innerHTML = '';

    // Show first tab
    showTab('details');

    // Load data from server
    await Promise.all([
        loadBookDetails(bookId),
        loadInventory(bookId),
        loadSpecialCopies(bookId)
    ]);

    // Show modal
    document.getElementById('book-editor-modal').style.display = 'block';
}

function closeBookEditor() {
    document.getElementById('book-editor-modal').style.display = 'none';
    currentBookId = null;
}

function showTab(tabName, event) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    document.getElementById('tab-' + tabName).classList.add('active');

    // Set active tab button
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Find the button for this tab and activate it
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.textContent.includes(tabName === 'details' ? 'פרטים' : tabName === 'inventory' ? 'מלאי' : 'עותקים')) {
                btn.classList.add('active');
            }
        });
    }
}

// ========================================
// Book Details Functions
// ========================================

async function loadBookDetails(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/book/${bookId}/details`);
        const result = await response.json();

        if (result.success && result.details) {
            const form = document.getElementById('details-form');
            const details = result.details;

            // Populate form fields
            if (details.subtitle) form.querySelector('[name="subtitle"]').value = details.subtitle;
            if (details.translator) form.querySelector('[name="translator"]').value = details.translator;
            if (details.publisher) form.querySelector('[name="publisher"]').value = details.publisher;
            if (details.year) form.querySelector('[name="year"]').value = details.year;
            if (details.pages) form.querySelector('[name="pages"]').value = details.pages;
            if (details.binding) form.querySelector('[name="binding"]').value = details.binding;
            if (details.size) form.querySelector('[name="size"]').value = details.size;
            if (details.series_name) form.querySelector('[name="series_name"]').value = details.series_name;
            if (details.number_in_series) form.querySelector('[name="number_in_series"]').value = details.number_in_series;
        }
    } catch (error) {
        console.error('Error loading book details:', error);
    }
}

// ========================================
// Inventory Functions
// ========================================

async function loadInventory(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/book/${bookId}/inventory`);
        const result = await response.json();

        if (result.success && result.inventory && result.inventory.length > 0) {
            result.inventory.forEach(item => {
                addInventoryRow(item);
            });
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

function addInventoryRow(data = {}) {
    const container = document.getElementById('inventory-list');

    const row = document.createElement('div');
    row.className = 'inventory-row';

    // Condition dropdown
    let conditionOptions = BOOK_CONDITIONS.map(c =>
        `<option value="${c}" ${data.condition === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    row.innerHTML = `
        <select class="condition-select">
            <option value="">-- בחר מצב --</option>
            ${conditionOptions}
        </select>
        <input type="number" class="quantity-input" placeholder="כמות" min="1" value="${data.quantity || ''}">
        <input type="number" class="price-input" placeholder="מחיר" min="0" step="0.01" value="${data.price || ''}">
        <button onclick="removeInventoryRow(this)">הסר</button>
    `;

    container.appendChild(row);
}

function removeInventoryRow(button) {
    button.closest('.inventory-row').remove();
}

// ========================================
// Special Copies Functions
// ========================================

async function loadSpecialCopies(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/book/${bookId}/special`);
        const result = await response.json();

        if (result.success && result.copies && result.copies.length > 0) {
            result.copies.forEach(copy => {
                addSpecialCopy(copy);
            });
        }
    } catch (error) {
        console.error('Error loading special copies:', error);
    }
}

function addSpecialCopy(data = {}) {
    const container = document.getElementById('special-copies-list');
    const copyNumber = container.children.length + 1;

    const card = document.createElement('div');
    card.className = 'special-copy-row';

    // Build condition notes checkboxes
    const conditionNotesHtml = CONDITION_NOTES.map(note => {
        const checked = data.condition_notes && data.condition_notes.includes(note) ? 'checked' : '';
        return `
            <label>
                <input type="checkbox" value="${note}" ${checked}>
                ${note}
            </label>
        `;
    }).join('');

    card.innerHTML = `
        <h4>עותק מיוחד #${copyNumber}</h4>
        <label>
            מחיר:
            <input type="number" class="special-price" placeholder="מחיר" min="0" step="0.01" value="${data.price || ''}">
        </label>
        <label>
            הערות מיוחדות:
            <textarea class="special-notes" placeholder="הערות מיוחדות על העותק">${data.special_notes || ''}</textarea>
        </label>
        <fieldset class="condition-notes-fieldset">
            <legend>הערות על מצב הספר</legend>
            ${conditionNotesHtml}
        </fieldset>
        <button onclick="removeSpecialCopy(this)" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">הסר עותק מיוחד</button>
    `;

    container.appendChild(card);
}

function removeSpecialCopy(button) {
    button.closest('.special-copy-row').remove();

    // Renumber remaining copies
    const copies = document.querySelectorAll('#special-copies-list .special-copy-row h4');
    copies.forEach((h4, index) => {
        h4.textContent = `עותק מיוחד #${index + 1}`;
    });
}

// ========================================
// Save Functions
// ========================================

async function saveBookData() {
    if (!currentBookId) {
        alert('שגיאה: לא נבחר ספר');
        return;
    }

    try {
        // Collect details form data
        const form = document.getElementById('details-form');
        const detailsData = {
            subtitle: form.querySelector('[name="subtitle"]').value,
            translator: form.querySelector('[name="translator"]').value,
            publisher: form.querySelector('[name="publisher"]').value,
            year: form.querySelector('[name="year"]').value ? parseInt(form.querySelector('[name="year"]').value) : null,
            pages: form.querySelector('[name="pages"]').value ? parseInt(form.querySelector('[name="pages"]').value) : null,
            binding: form.querySelector('[name="binding"]').value,
            size: form.querySelector('[name="size"]').value,
            series_name: form.querySelector('[name="series_name"]').value,
            number_in_series: form.querySelector('[name="number_in_series"]').value ? parseInt(form.querySelector('[name="number_in_series"]').value) : null
        };

        // Collect inventory data
        const inventoryItems = [];
        document.querySelectorAll('#inventory-list .inventory-row').forEach(row => {
            const condition = row.querySelector('.condition-select').value;
            const quantity = row.querySelector('.quantity-input').value;
            const price = row.querySelector('.price-input').value;

            if (condition && quantity) {
                inventoryItems.push({
                    condition: condition,
                    quantity: parseInt(quantity),
                    price: price ? parseFloat(price) : 0
                });
            }
        });

        // Collect special copies data
        const specialCopies = [];
        document.querySelectorAll('#special-copies-list .special-copy-row').forEach(card => {
            const price = card.querySelector('.special-price').value;
            const notes = card.querySelector('.special-notes').value;
            const conditionNotes = [];

            card.querySelectorAll('.condition-notes-fieldset input[type="checkbox"]:checked').forEach(checkbox => {
                conditionNotes.push(checkbox.value);
            });

            specialCopies.push({
                price: price ? parseFloat(price) : 0,
                special_notes: notes,
                condition_notes: conditionNotes
            });
        });

        // Save all data to server
        const [detailsRes, inventoryRes, specialRes] = await Promise.all([
            fetch(`${API_BASE_URL}/book/${currentBookId}/details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(detailsData)
            }),
            fetch(`${API_BASE_URL}/book/${currentBookId}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: inventoryItems })
            }),
            fetch(`${API_BASE_URL}/book/${currentBookId}/special`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ copies: specialCopies })
            })
        ]);

        const detailsResult = await detailsRes.json();
        const inventoryResult = await inventoryRes.json();
        const specialResult = await specialRes.json();

        if (detailsResult.success && inventoryResult.success && specialResult.success) {
            alert('הנתונים נשמרו בהצלחה!');
            closeBookEditor();
        } else {
            alert('שגיאה בשמירת הנתונים');
        }

    } catch (error) {
        console.error('Error saving book data:', error);
        alert('שגיאה בשמירת הנתונים: ' + error.message);
    }
}

// ========================================
// Statistics Functions
// ========================================

async function updateStats() {
    const statsDiv = document.getElementById('stats-display');

    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        const result = await response.json();

        if (result.database_exists) {
            statsDiv.innerHTML = `סה"כ ספרים במסד הנתונים: <strong>${result.total_books}</strong>`;
        } else {
            statsDiv.innerHTML = 'מסד הנתונים ריק';
        }
    } catch (error) {
        statsDiv.innerHTML = `שגיאה בטעינת סטטיסטיקות: ${error.message}`;
    }
}

function loadStats() {
    updateStats();
}

// ========================================
// Export Function
// ========================================

function exportDatabase() {
    alert('ייצוא נתונים - תכונה זו תתווסף בגרסה הבאה.\nבגרסה הנוכחית הנתונים נשמרים בשרת.');
}

// ========================================
// Utility Functions
// ========================================

function showStatus(element, message, type) {
    if (element) {
        element.className = `status-message ${type}`;
        element.textContent = message;
    }
}

// ========================================
// Event Listeners
// ========================================

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('book-editor-modal');
    if (event.target === modal) {
        closeBookEditor();
    }
};

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeBookEditor();
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateStats();
});
