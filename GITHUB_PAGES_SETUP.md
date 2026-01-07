# GitHub Pages Setup Guide

## Quick Start

Your Ayal Kore Book Catalog website is ready to deploy to GitHub Pages!

### Files Ready for Deployment:
- ✅ `index.html` - Main page (browser-only version)
- ✅ `app.js` - Application logic with IndexedDB
- ✅ `styles.css` - Styling

### Next Steps:

#### 1. Enable GitHub Pages

1. Go to your repository: https://github.com/gitDawn/ayal-kore
2. Click **Settings** tab
3. Scroll to **Pages** in the left sidebar
4. Under **Source**:
   - Branch: Select `master` (or `main`)
   - Folder: Select `/ (root)`
5. Click **Save**

#### 2. Wait for Deployment

- GitHub will automatically build your site
- Check the green checkmark on the **Actions** tab
- Usually takes 1-2 minutes

#### 3. Access Your Website

Your site will be live at:
**https://gitdawn.github.io/ayal-kore/**

---

## How It Works

### Browser-Only Architecture

This version uses **IndexedDB** for client-side storage:

- **No Server Needed**: Everything runs in the browser
- **Local Data**: Each user's data is stored locally on their device
- **Excel Upload**: Uses SheetJS library to read Excel files
- **Search**: Fast local search across all fields
- **Export**: Download data as JSON for backup

### Key Features:

1. **Upload Danalog Catalog**
   - Select Excel file (.xlsx or .xls)
   - Automatically assigns unique IDs
   - Skips duplicate entries based on דאנאקוד

2. **Search Books**
   - Search by any field
   - Partial text matching
   - Clean results display

3. **Database Management**
   - View statistics
   - Export data (JSON backup)
   - Clear all data

---

## Important Notes

### Data Persistence

- Data is stored in the browser's IndexedDB
- Data persists across page refreshes
- Data is **local to each device/browser**
- Clearing browser cache will delete data

### Backup Recommendations

1. Export data regularly using the "ייצא נתונים" button
2. Keep original Excel files as backups
3. Consider setting up automated backups

### Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

---

## Testing Before Deployment

To test locally before deploying:

```bash
# Navigate to repository
cd "C:\Users\user\Google Drive Streaming\My Drive\Work\Simania Eyal\Ayal_Kore"

# Start local server
python -m http.server 8000

# Open in browser: http://localhost:8000
```

---

## Alternative Deployment Options

### Option A: Deploy to `gh-pages` Branch

1. Create a new branch:
```bash
git checkout -b gh-pages
git push origin gh-pages
```

2. In GitHub Pages settings, select `gh-pages` branch

### Option B: Deploy from `docs/` Folder

1. Create docs folder and copy files:
```bash
mkdir docs
cp index.html docs/
cp app.js docs/
cp styles.css docs/
git add docs/
git commit -m "Add docs folder for GitHub Pages"
git push
```

2. In GitHub Pages settings, select `master` branch and `/docs` folder

---

## Troubleshooting

### Site Not Loading
- Wait 2-3 minutes after enabling GitHub Pages
- Check Actions tab for build errors
- Verify branch and folder settings

### Excel Upload Fails
- Must be served via HTTP/HTTPS (not file://)
- Check browser console (F12) for errors
- Verify SheetJS CDN is accessible

### Data Disappeared
- Check if browser cache was cleared
- Restore from exported JSON backup
- Re-upload original Excel file

---

## Next Steps After Deployment

1. ✅ Test the live website
2. ✅ Upload a test Excel file
3. ✅ Verify search functionality
4. ✅ Export a backup
5. ✅ Share the URL with users

---

## Support & Documentation

- **Main Documentation**: [README.md](website/README.md)
- **Requirements**: [Ayal Kore Requirements.txt](Ayal Kore Requirements.txt)
- **Deployment Guide**: [DEPLOYMENT.md](website/DEPLOYMENT.md)

---

## Repository Information

- **GitHub Repo**: https://github.com/gitDawn/ayal-kore
- **Live Site**: https://gitdawn.github.io/ayal-kore/ (after enabling Pages)
- **Local Path**: C:\Users\user\Google Drive Streaming\My Drive\Work\Simania Eyal\Ayal_Kore\

---

Enjoy your new book catalog system! 📚
