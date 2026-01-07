// API Base URL
const API_URL = 'http://localhost:5000';

// Upload Danalog Excel file
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

    try {
        showStatus(statusDiv, 'מעלה קובץ...', 'info');

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            showStatus(statusDiv,
                `הקובץ הועלה בהצלחה! נוספו ${result.added} רשומות חדשות, דולגו ${result.skipped} רשומות קיימות. סה"כ רשומות: ${result.total}`,
                'success');
        } else {
            showStatus(statusDiv, `שגיאה: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(statusDiv, `שגיאה בהעלאת הקובץ: ${error.message}`, 'error');
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

        const response = await fetch(`${API_URL}/search?column=${encodeURIComponent(column)}&text=${encodeURIComponent(searchText)}`);
        const result = await response.json();

        if (response.ok) {
            if (result.results.length === 0) {
                showStatus(statusDiv, 'לא נמצאו תוצאות', 'info');
                resultsTitle.style.display = 'none';
                resultsTable.innerHTML = '';
            } else {
                showStatus(statusDiv, `נמצאו ${result.results.length} תוצאות`, 'success');
                displayResults(result.results);
            }
        } else {
            showStatus(statusDiv, `שגיאה: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(statusDiv, `שגיאה בחיפוש: ${error.message}`, 'error');
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
        statsDisplay.innerHTML = '<p>טוען סטטיסטיקות...</p>';

        const response = await fetch(`${API_URL}/stats`);
        const result = await response.json();

        if (response.ok) {
            let html = `
                <div class="stat-card">
                    <h3>סה"כ ספרים</h3>
                    <div class="stat-value">${result.total_books}</div>
                </div>
            `;

            if (result.database_exists) {
                html += `
                    <div class="stat-card">
                        <h3>סטטוס מסד נתונים</h3>
                        <div class="stat-value">✓</div>
                    </div>
                `;
            }

            statsDisplay.innerHTML = html;
        } else {
            statsDisplay.innerHTML = `<p>שגיאה בטעינת סטטיסטיקות: ${result.error}</p>`;
        }
    } catch (error) {
        statsDisplay.innerHTML = `<p>שגיאה: ${error.message}</p>`;
    }
}

// Helper function to show status messages
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
}

// Load stats on page load
window.addEventListener('DOMContentLoaded', () => {
    loadStats();
});
