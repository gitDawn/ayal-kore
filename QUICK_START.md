# Ayal Kore Book Catalog - Quick Start

## ✅ Implementation Complete!

Your book catalog system is ready for GitHub Pages deployment.

---

## 🚀 Enable GitHub Pages (3 Steps)

### Step 1: Go to Repository Settings
Visit: https://github.com/gitDawn/ayal-kore/settings/pages

### Step 2: Configure GitHub Pages
- **Source**: Deploy from a branch
- **Branch**: `master`
- **Folder**: `/ (root)`
- Click **Save**

### Step 3: Wait & Access
- Wait 1-2 minutes for deployment
- Your site will be live at: **https://gitdawn.github.io/ayal-kore/**

---

## 📚 What You Built

### Two Complete Versions:

#### 1. **GitHub Pages Version** (Browser-Only) ⭐
- **Location**: Root directory (`index.html`, `app.js`, `styles.css`)
- **Storage**: IndexedDB (browser local storage)
- **Hosting**: GitHub Pages (free)
- **URL**: https://gitdawn.github.io/ayal-kore/
- **Status**: ✅ Ready to deploy

**Features:**
- ✅ Upload Excel catalogs
- ✅ Search by multiple fields
- ✅ View statistics
- ✅ Export data (JSON backup)
- ✅ Clear database
- ✅ No server required

#### 2. **Flask Backend Version** (Server-Based)
- **Location**: `website/` directory
- **Storage**: SQLite database on server
- **Hosting**: Requires Python server
- **Status**: ✅ Complete (for local use)

**Run Locally:**
```bash
cd website
python server.py
# Open http://localhost:5000
```

---

## 📖 Key Features

### Part 1: Upload Danalog Catalog
- Excel file upload (.xlsx, .xls)
- Automatic unique ID assignment
- Smart duplicate detection (by דאנאקוד)
- Support for books without Danalog codes

### Part 2: Search Catalog
- Multi-field search:
  - דאנאקוד, שם, מחבר, נושא, מחיר, ברקוד
- Partial text matching
- Clean results display
- Shows only relevant fields

### Part 3: Database Management
- View total books count
- Export data to JSON
- Clear all data
- Database status monitoring

---

## 💾 Data Management

### Browser Version (GitHub Pages):
- **Storage**: Browser IndexedDB
- **Scope**: Local to each device/browser
- **Persistence**: Survives page refreshes
- **Backup**: Export JSON regularly

### Important Notes:
⚠️ Data is **not shared** between users or devices
⚠️ Clearing browser cache **will delete** data
✅ Export data regularly for backup
✅ Keep original Excel files safe

---

## 📁 Repository Structure

```
ayal-kore/
├── index.html              # GitHub Pages main file
├── app.js                  # IndexedDB application logic
├── styles.css              # Responsive styling
├── GITHUB_PAGES_SETUP.md   # Deployment guide
├── QUICK_START.md          # This file
│
├── website/                # Flask backend version
│   ├── index.html          # Server version UI
│   ├── index-github.html   # Source for root index.html
│   ├── server.py           # Flask backend
│   ├── script.js           # Server version JS
│   ├── app.js              # Browser version JS
│   ├── styles.css          # Styling
│   ├── requirements.txt    # Python dependencies
│   ├── README.md           # Full documentation
│   ├── DEPLOYMENT.md       # Deployment guide
│   └── start_server.bat    # Windows startup script
│
├── Danalog/                # Catalog data
│   └── Danalog_0-1070616.xlsx
│
└── Ayal Kore Requirements.txt  # Project requirements
```

---

## 🔗 Important Links

- **GitHub Repo**: https://github.com/gitDawn/ayal-kore
- **Live Site** (after enabling Pages): https://gitdawn.github.io/ayal-kore/
- **Settings**: https://github.com/gitDawn/ayal-kore/settings/pages

---

## 📋 Testing Checklist

Before going live, test these features:

- [ ] Upload an Excel file
- [ ] Search for a book by name
- [ ] Search for a book by author
- [ ] View statistics
- [ ] Export data to JSON
- [ ] Clear database
- [ ] Verify data persists after page refresh

---

## 🆘 Troubleshooting

### Excel Upload Fails
- ✅ Must access via HTTP (not file://)
- ✅ Check browser console (F12) for errors
- ✅ Verify file is .xlsx or .xls format

### Data Disappeared
- ✅ Check if browser cache was cleared
- ✅ Restore from exported JSON (if available)
- ✅ Re-upload original Excel file

### Site Not Loading
- ✅ Wait 2-3 minutes after enabling Pages
- ✅ Check GitHub Actions tab for errors
- ✅ Verify settings: master branch, / (root) folder

---

## 📚 Documentation

- **Quick Start**: `QUICK_START.md` (this file)
- **GitHub Pages Setup**: `GITHUB_PAGES_SETUP.md`
- **Full Deployment Guide**: `website/DEPLOYMENT.md`
- **Feature Documentation**: `website/README.md`
- **Requirements**: `Ayal Kore Requirements.txt`

---

## 🎉 Next Steps

1. ✅ Enable GitHub Pages (see instructions above)
2. ✅ Test the live website
3. ✅ Upload your first catalog
4. ✅ Export a backup
5. ✅ Share with users: https://gitdawn.github.io/ayal-kore/

---

## 📞 Support

For questions or issues:
- Check documentation files listed above
- Review `Ayal Kore Requirements.txt`
- Check GitHub repository

---

**Repository**: https://github.com/gitDawn/ayal-kore
**Local Path**: C:\Users\user\Google Drive Streaming\My Drive\Work\Simania Eyal\Ayal_Kore\

---

Happy cataloging! 📚✨
