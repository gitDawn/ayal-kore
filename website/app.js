// API-based version for online database
// This version connects to the Flask backend server

const API_BASE_URL = 'https://ayal-kore.onrender.com';

// Upload and process Excel file
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

// Search catalog
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

// Display search results
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
    html += '<th>דאנאקוד</th>';
    html += '<th>שם הספר</th>';
    html += '<th>מחבר</th>';
    html += '<th>נושא</th>';
    html += '<th>מחיר</th>';
    html += '<th>ברקוד</th>';
    html += '</tr></thead><tbody>';

    results.forEach(book => {
        html += '<tr>';
        html += `<td>${book['דאנאקוד'] || ''}</td>`;
        html += `<td>${book['שם'] || ''}</td>`;
        html += `<td>${book['מחבר'] || ''}</td>`;
        html += `<td>${book['נושא'] || ''}</td>`;
        html += `<td>${book['מחיר'] || ''}</td>`;
        html += `<td>${book['ברקוד'] || ''}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    resultsDiv.innerHTML = html;
}

// Update statistics
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

// Alias for loadStats (called from HTML)
function loadStats() {
    updateStats();
}

// Export database (MVP - shows message)
function exportDatabase() {
    alert('ייצוא נתונים - תכונה זו תתווסף בגרסה הבאה.\nבגרסה הנוכחית הנתונים נשמרים בשרת.');
}

// Clear database (MVP - shows message)
function clearDatabase() {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים?')) {
        alert('מחיקת נתונים - תכונה זו תתווסף בגרסה הבאה.');
    }
}

// Show status message
function showStatus(element, message, type) {
    if (element) {
        element.className = `status-message ${type}`;
        element.textContent = message;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateStats();
});