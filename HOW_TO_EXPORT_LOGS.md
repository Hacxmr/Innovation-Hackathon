# How to Export Windows Security Logs (Requires Admin)

## ⚠️ The Issue
Security event logs require **Administrator privileges** to access.

---

## ✅ Solution 1: Run PowerShell as Administrator

### Step 1: Open PowerShell as Admin
1. Press `Win + X` or right-click Start button
2. Select **"Windows PowerShell (Admin)"** or **"Terminal (Admin)"**
3. Click "Yes" on UAC prompt

### Step 2: Navigate to project folder
```powershell
cd "C:\Users\Mitali Raj\Downloads\sentinel-forensic-ai"
```

### Step 3: Export Security logs
```powershell
# Export last 100 Security events
wevtutil qe Security /c:100 /f:text > security-logs.txt

# Or export last 24 hours of Security events
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss")
wevtutil qe Security "/q:*[System[TimeCreated[@SystemTime>='$yesterday']]]" /f:text > security-logs.txt
```

---

## ✅ Solution 2: Use Available Logs (No Admin Needed)

### Already Created For You:
- ✅ **application-logs.txt** - 50 application events
- ✅ **app-events.txt** - 30 formatted app events
- ✅ **sample-logs.txt** - 15 realistic forensic samples

### You Can Also Export:
```powershell
# System logs (usually accessible)
wevtutil qe System /c:50 /f:text > system-logs.txt

# PowerShell logs
wevtutil qe "Windows PowerShell" /c:50 /f:text > powershell-logs.txt

# Windows Defender logs (if available)
wevtutil qe "Microsoft-Windows-Windows Defender/Operational" /c:50 /f:text > defender-logs.txt 2>$null
```

---

## 🎯 Quick Test - Upload These Files Now:

1. **application-logs.txt** - Real Windows application events
2. **app-events.txt** - Formatted application events  
3. **sample-logs.txt** - Pre-made forensic samples

Go to your app → "Ingest Evidence" → Upload any of these files!

---

## 📋 Alternative: Export Specific Event Types

### Failed Login Attempts (if admin PowerShell):
```powershell
Get-WinEvent -FilterHashtable @{LogName='Security'; ID=4625} -MaxEvents 20 | 
Select-Object TimeCreated, Message | 
Format-List | Out-File failed-logins.txt
```

### Network Connection Logs:
```powershell
netstat -ano > network-connections.txt
Get-NetTCPConnection | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess | 
Format-Table | Out-File network-state.txt
```

### Running Processes:
```powershell
Get-Process | Select-Object Name, Id, CPU, WorkingSet, Path | 
Sort-Object CPU -Descending | 
Select-Object -First 50 | 
Format-Table | Out-File processes.txt
```

---

## 💡 Pro Tip: Use What You Have!

You don't need Security logs to test the app. The **application-logs.txt** already contains real Windows events that the AI can analyze for:
- Application crashes
- Error patterns
- System warnings
- Service failures
- Performance issues

Upload it and let the AI do its forensic magic! 🎯
