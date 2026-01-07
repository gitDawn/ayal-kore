# Deployment Guide

## GitHub Pages Deployment

This project has two versions:

### 1. **Browser-Only Version** (GitHub Pages Compatible)
- **Files**: `index-github.html`, `app.js`, `styles.css`
- **Storage**: IndexedDB (browser local storage)
- **Hosting**: GitHub Pages
- **URL**: https://gitdawn.github.io/ayal-kore/

**Pros:**
- No server needed
- Free hosting on GitHub Pages
- Works offline after first load
- Fast and responsive

**Cons:**
- Data stored locally in browser only
- Each user has their own database
- Data clears if browser cache is cleared

### 2. **Flask Backend Version** (Requires Server)
- **Files**: `index.html`, `server.py`, `script.js`, `styles.css`
- **Storage**: SQLite database on server
- **Hosting**: Requires Python server (PythonAnywhere, Heroku, etc.)

**Pros:**
- Centralized database
- Multi-user support
- Data persists across devices

**Cons:**
- Requires server hosting
- May have hosting costs
- Needs server maintenance

---

## How to Deploy to GitHub Pages

### Step 1: Prepare the Repository

1. Copy `index-github.html` to `index.html` in the root directory:
```bash
cp website/index-github.html index.html
cp website/app.js app.js
cp website/styles.css styles.css
```

2. Commit the files:
```bash
git add index.html app.js styles.css
git commit -m "Add GitHub Pages deployment files"
git push origin master
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: https://github.com/gitDawn/ayal-kore
2. Click on **Settings**
3. Scroll down to **Pages** section (left sidebar)
4. Under **Source**, select:
   - Branch: `master`
   - Folder: `/root`
5. Click **Save**

### Step 3: Wait for Deployment

GitHub Pages will automatically build and deploy your site. This usually takes 1-2 minutes.

Your site will be available at: **https://gitdawn.github.io/ayal-kore/**

---

## Alternative: Deploy from `docs/` Folder

If you prefer to keep GitHub Pages files separate:

1. Create `docs/` folder in repository root:
```bash
mkdir docs
cp website/index-github.html docs/index.html
cp website/app.js docs/app.js
cp website/styles.css docs/styles.css
```

2. In GitHub Pages settings, select:
   - Branch: `master`
   - Folder: `/docs`

---

## Testing Locally

To test the GitHub Pages version locally:

1. Open `index-github.html` directly in your browser, OR

2. Use a local HTTP server:
```bash
# Python 3
python -m http.server 8000

# Then open: http://localhost:8000/index-github.html
```

**Note**: For Excel file upload to work, you MUST use an HTTP server (option 2). Opening the file directly (option 1) may have CORS restrictions.

---

## Database Export/Import

Since the browser version uses local storage:

1. **Export Data**: Click "ייצא נתונים (JSON)" button to download a backup
2. **Import Data**: Currently manual - will need to re-upload Excel files
3. **Backup Regularly**: Download exports before clearing browser cache

---

## Future Enhancement: Backend Version Deployment

If you later want to deploy the Flask backend version:

### Option A: PythonAnywhere (Free Tier)
1. Sign up at https://www.pythonanywhere.com
2. Upload `server.py` and database files
3. Configure WSGI file
4. Update frontend API URL

### Option B: Railway (Free Tier)
1. Sign up at https://railway.app
2. Connect GitHub repository
3. Railway auto-detects Flask app
4. Update frontend API URL

### Option C: Render (Free Tier)
1. Sign up at https://render.com
2. Create new Web Service
3. Connect GitHub repository
4. Update frontend API URL

---

## Troubleshooting

### Excel Upload Not Working
- Make sure you're using an HTTP server, not opening the file directly
- Check browser console for errors (F12)
- Verify SheetJS CDN is loading

### Data Lost After Browser Update
- This is expected behavior with IndexedDB
- Export data regularly as backup
- Consider deploying backend version for persistent storage

### Search Not Working
- Ensure data has been uploaded first
- Check that search field and text are both filled
- Try refreshing the page

---

## Support

For issues or questions, refer to:
- [Main README](README.md)
- [Requirements Document](../Ayal Kore Requirements.txt)
- GitHub Issues: https://github.com/gitDawn/ayal-kore/issues
