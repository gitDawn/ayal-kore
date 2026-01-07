@echo off
echo ====================================
echo Ayal Kore Book Catalog Server
echo ====================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8 or higher
    pause
    exit /b 1
)

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting Flask server...
echo Server will run on http://localhost:5000
echo.
echo To access the website, open index.html in your browser
echo or run a local HTTP server in another terminal:
echo   python -m http.server 8000
echo.
echo Press Ctrl+C to stop the server
echo.

python server.py

pause
