# 🚀 VS Code WSL Optimization Guide
**Last Updated:** November 8, 2025  
**System:** 8GB RAM, Intel i5-8250U, WSL2 Ubuntu

---

## ✅ Current Configuration

### 1. WSL Configuration (`.wslconfig`)
```ini
[wsl2]
memory=4GB              # 50% of total RAM
processors=4            # All CPU cores
swap=1GB                # Minimal swap to reduce SSD wear
swapfile=C:\\temp\\wsl-swap.vhdx
debugConsole=false
localhostForwarding=true
nestedVirtualization=false
kernelCommandLine=vsyscall=emulate

[experimental]
sparseVhd=true
autoMemoryReclaim=gradual  # Auto-free unused RAM
```

**Location:** `C:\Users\Admin\.wslconfig` (Windows)

---

### 2. Windows Defender Exclusions

**Excluded Paths:**
- `\\wsl$\Ubuntu\home\abeachmad\ZeroToll`
- `\\wsl$\Ubuntu`
- `C:\Users\Admin\app`

**Excluded Processes:**
- `wsl.exe`
- `wslhost.exe`

**Verify:**
```powershell
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
Get-MpPreference | Select-Object -ExpandProperty ExclusionProcess
```

---

### 3. VS Code File Watchers

**Files:**
- `.vscodeignore` - Excludes from VS Code Remote Server
- `.gitignore` - Excludes from Git and VS Code search
- `settings.json` - File watcher limits

**Key Settings:**
- `files.watcherExclude` - Don't watch build/dependency folders
- `search.maxResults: 5000` - Limit search results
- `remote.WSL.fileWatcher.polling: true` - Use polling instead of inotify

---

## 🔧 When Connection Fails

### Quick Fix (No Reload Needed)

**Method 1: VS Code Command**
1. Press `Ctrl+Shift+P`
2. Type: "Remote-WSL: Restart Connection"
3. Wait for reconnection

**Method 2: Run Cleanup Script**
```bash
~/fix-vscode.sh
```
Then reconnect VS Code.

**Method 3: Manual Cleanup**
```bash
# Kill VS Code processes
pkill -f "vscode-server"

# Clean cache
rm -rf ~/.vscode-server/bin/*/vscode-remote-lock*
rm -rf ~/.vscode-server/data/logs/*

# Kill orphan processes
pkill -f "node.*webpack"
pkill -f "node.*craco"
```

**Method 4: Full WSL Restart** (Last Resort)
```powershell
# In PowerShell (Windows):
wsl --shutdown
# Wait 5 seconds
wsl
# Reconnect VS Code
```

---

## 📊 Monitor Performance

### Check WSL Memory
```bash
free -h
# Or detailed:
htop  # Install: sudo apt install htop
```

**Healthy Usage:**
- Used: < 3.5GB (out of 3.8GB available)
- Free: > 300MB
- Swap Used: 0 (ideal) or < 100MB

### Check VS Code Processes
```bash
ps aux | grep vscode-server | grep -v grep | wc -l
```
**Normal:** 10-20 processes  
**High:** > 30 processes (run cleanup)

### Check Node Processes
```bash
ps aux | grep node | grep -v grep
```
**Issue:** If you see multiple `webpack-dev-server` or orphaned processes

### Kill Orphan Processes
```bash
# Auto-cleanup (runs on shell exit due to .bashrc trap)
# Or manual:
pkill -f "node.*webpack"
pkill -f "node.*craco"
```

---

## 🎯 Best Practices

### 1. **Regular Cleanup**
Run every few days:
```bash
# Clear package caches
cd ~/ZeroToll
rm -rf frontend/node_modules/.cache
rm -rf backend/__pycache__
rm -rf packages/*/node_modules/.cache

# Clear logs
rm -f *.log
rm -f nohup.out
```

### 2. **Limit Background Processes**
When not developing:
```bash
# Stop backend
sudo kill $(lsof -ti:8000)

# Stop frontend
sudo kill $(lsof -ti:3000)

# Stop MongoDB if not needed
sudo systemctl stop mongodb
```

### 3. **Periodic WSL Restart**
Once per day or when switching projects:
```powershell
# In PowerShell:
wsl --shutdown
```
This frees all WSL memory back to Windows.

### 4. **Use Git Ignore Properly**
Don't track:
- `node_modules/`
- `venv/`
- `build/`, `dist/`, `artifacts/`
- `*.log`, `*.pyc`

---

## ⚡ Performance Tips

### VS Code Extensions
**Disable unused extensions:**
1. `Ctrl+Shift+X` → Extensions
2. Disable extensions not needed for current project
3. Especially heavy ones: Prettier, ESLint auto-fix, etc.

### Terminal Optimization
**Close unused terminals:**
- Don't keep 10+ terminals open
- Use `exit` or close terminal panel when done

### File Watching
**Reduce watched files:**
- Don't open entire `node_modules` in editor
- Use "Open Folder" on specific subdirectory when possible

---

## 🆘 Emergency Recovery

### Connection Keeps Failing Every 15 Minutes

**Likely Cause:** Memory pressure

**Solution 1: Increase WSL Memory**
```ini
# Edit C:\Users\Admin\.wslconfig
[wsl2]
memory=5GB  # Increase from 4GB (leaves 3GB for Windows)
```

**Solution 2: Close Other Apps**
- Close Chrome tabs (each tab = ~100MB RAM)
- Close unused Windows applications
- Check Windows Task Manager for memory hogs

**Solution 3: Reduce Active Projects**
- Work on 1 project at a time in VS Code
- Close other VS Code windows

### VS Code Server Crash on File Operations

**Symptom:** Connection fails during grep/search

**Solution:**
```json
// Add to settings.json:
{
  "search.maxResults": 2000,  // Reduce from 5000
  "files.watcherExclude": {
    // Add more exclusions
    "**/.cache/**": true,
    "**/tmp/**": true
  }
}
```

### Slow File Operations

**Cause:** Windows Defender scanning WSL files

**Verify Exclusion:**
```powershell
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
# Should show: \\wsl$\Ubuntu
```

**Re-add if missing:**
```powershell
Add-MpPreference -ExclusionPath "\\wsl$\Ubuntu"
```

---

## 📈 Expected Performance

### Before Optimization
- ❌ Connection fails every 15-30 minutes
- ❌ Slow file operations
- ❌ High CPU usage
- ❌ Must reload window frequently

### After Optimization
- ✅ Stable for 2-4 hours continuous work
- ✅ Fast file operations (< 1s for search)
- ✅ Normal CPU usage
- ✅ Auto-recovery from minor issues

---

## 📝 Maintenance Schedule

### Daily
- [ ] Close unused terminals/processes
- [ ] Clear browser cache if needed

### Weekly
- [ ] Run `fix-vscode.sh`
- [ ] Clear `node_modules/.cache`
- [ ] WSL shutdown/restart

### Monthly
- [ ] Update VS Code
- [ ] Clean Docker images (if using)
- [ ] Review and disable unused extensions

---

## 🔗 Quick Reference

**Cleanup Script:** `~/fix-vscode.sh`  
**WSL Config:** `C:\Users\Admin\.wslconfig`  
**VS Code Settings:** `.vscode/settings.json`  
**Exclusions:** `.vscodeignore`, `.gitignore`

**Monitor Commands:**
```bash
free -h                  # Memory
htop                     # Processes
ps aux | grep vscode     # VS Code processes
ps aux | grep node       # Node processes
lsof -i :8000           # Backend port
lsof -i :3000           # Frontend port
```

---

**Last Optimization:** November 8, 2025  
**Status:** ✅ All optimizations applied  
**Next Review:** Weekly or when issues occur
