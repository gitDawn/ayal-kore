# Build Instructions for Ayal Kore Online Database

This document explains all the changes made to convert the local database app to an online database system.

## Overview of Changes

The application was converted from using local SQLite database with IndexedDB frontend to using MongoDB Atlas cloud database with a Flask API backend.

### Key Changes Made:

1. **Backend Database Migration (server.py)**
   - Replaced SQLite with MongoDB Atlas
   - Added PyMongo and Flask-PyMongo dependencies
   - Updated all database operations to use MongoDB collections instead of SQL tables
   - Added environment variable support for secure database credentials

2. **Frontend API Integration (app.js)**
   - Replaced IndexedDB operations with REST API calls
   - Updated upload, search, and stats functions to use fetch() to backend endpoints
   - Simplified code by removing complex IndexedDB initialization and transaction logic

3. **Dependencies Update (requirements.txt)**
   - Added pymongo, flask-pymongo, python-dotenv
   - Kept existing dependencies for Excel processing and CORS

4. **Environment Configuration (.env)**
   - Added secure storage for MongoDB connection string
   - Prevents hardcoding sensitive credentials

5. **UI Updates (index.html)**
   - Changed subtitle to indicate online database usage

## Step-by-Step Setup Instructions

### 1. Set Up MongoDB Atlas Account
- Go to https://www.mongodb.com/atlas
- Create a free account
- Create a new cluster (free tier available)
- Create a database user with read/write permissions
- Get your connection string from the "Connect" button

### 2. Configure Environment Variables
- Edit the `.env` file in the `website/` directory
- Replace the MONGO_URI with your actual MongoDB Atlas connection string
- Example: `mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/ayal_kore?retryWrites=true&w=majority`

### 3. Install Dependencies
```bash
cd website/
pip install -r requirements.txt
```

### 4. Test Local Development
```bash
python server.py
```
- Server should start on http://localhost:5000
- Open index.html in browser to test the interface

### 5. Deploy to Production
Choose one of these deployment options:

#### Option A: Heroku (Recommended)
1. Create Heroku account at https://heroku.com
2. Install Heroku CLI
3. Create a new app: `heroku create your-app-name`
4. Set environment variables: `heroku config:set MONGO_URI="your_mongodb_uri"`
5. Deploy: `git push heroku main`

#### Option B: Railway
1. Go to https://railway.app
2. Connect your GitHub repository
3. Set environment variables in Railway dashboard
4. Deploy automatically

#### Option C: AWS/GCP/Azure
- More complex setup required
- Use their respective cloud database services
- Deploy Flask app using their app engine services

### 6. Update Frontend API URL
- In `app.js`, change `API_BASE_URL` from `'http://localhost:5000'` to your deployed server URL
- Example: `const API_BASE_URL = 'https://your-app.herokuapp.com';`

### 7. Data Migration (Optional)
If you have existing data in the old SQLite database:
1. Export data from SQLite to JSON/CSV
2. Import into MongoDB Atlas using MongoDB Compass or command line tools
3. Test that all data transferred correctly

## Security Considerations

- Never commit `.env` file to version control
- Use strong passwords for MongoDB Atlas
- Enable IP whitelisting in MongoDB Atlas for production
- Consider adding authentication to the API endpoints for production use

## Troubleshooting

### Common Issues:

1. **Connection Refused**: Check MongoDB Atlas IP whitelist and connection string
2. **CORS Errors**: Ensure Flask-CORS is properly configured
3. **Import Errors**: Verify all dependencies are installed
4. **Data Not Saving**: Check MongoDB user permissions and database name

### Testing the API:
- Visit `http://localhost:5000/stats` to check database connection
- Use browser dev tools to monitor network requests
- Check server logs for detailed error messages

## Architecture Benefits

- **Scalability**: MongoDB Atlas can handle much larger datasets
- **Multi-user**: Multiple users can access the same database
- **Backup**: Automatic backups provided by MongoDB Atlas
- **Performance**: Cloud database typically faster than local SQLite
- **Reliability**: No data loss if local machine crashes

## Future Enhancements

- Add user authentication
- Implement data validation
- Add backup/restore functionality
- Create admin dashboard for database management
- Add real-time synchronization for multiple users