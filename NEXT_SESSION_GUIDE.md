# 🚀 NEXT SESSION QUICK START GUIDE

## When You Come Back Tomorrow (or Next Time)

### **Prerequisites:**
- ✅ Jiya photos saved in `/Users/macbookair/Downloads/` (IMG_8*.jpg)
- ✅ Google Colab notebook ready: `~/Downloads/MIB-Hub/tools/COLAB_BLENDER_MCP_SETUP_FIXED.ipynb`
- ✅ One-click startup script: `~/Downloads/MIB-Hub/start-colab-session.sh`

---

## 🎯 **3-Step Startup (5 Minutes Total)**

### **Step 1: Start Omniroute** (separate terminal)
```bash
# In a new terminal window, start omniroute
omniroute
```
Leave this running — don't close the terminal.

---

### **Step 2: Start Google Colab** (in browser)

1. Go to https://colab.research.google.com/
2. **Upload notebook:** `~/Downloads/MIB-Hub/tools/COLAB_BLENDER_MCP_SETUP_FIXED.ipynb`
3. **Set Runtime:** Click "Runtime → Change runtime type → GPU (T4)"
4. **Run all cells:** Click "Runtime → Run all"
5. **Wait ~2 minutes** for installation
6. **Cell 6 will print:**
   ```
   📡 Public URL: https://something-unique.ngrok-free.dev
   ```
7. **Copy that URL** (just the https://... part)

---

### **Step 3: Run One-Click Setup** (in your main terminal)

```bash
cd ~/Downloads/MIB-Hub
./start-colab-session.sh
```

The script will:
- ✅ Check omniroute is running
- ✅ Prompt you to paste the ngrok URL
- ✅ Automatically configure `claude-personal`
- ✅ Tell you when it's ready

---

## 💬 **Step 4: Start Claude Session**

In your terminal (where omniroute is running):
```bash
claude-personal
```

Then **in the chat**, say:
> "MCP connected at https://[YOUR_NGROK_URL].ngrok-free.dev"

(Or just say "connected" if the script already showed success)

---

## 🎨 **What Happens Next**

I will:
1. ✅ Test the MCP connection
2. ✅ Read Jiya's photos from `/Users/macbookair/Downloads/IMG_8*.jpg`
3. ✅ Read character specs from `CHARACTERS.md`
4. ✅ Generate Jiya's 3D model (base body + 6 outfits)
5. ✅ Render T-pose screenshots for your approval
6. ✅ Export optimized `.glb` files to Google Drive
7. ✅ Continue with other characters (Mum, Dad, etc.)

---

## 📂 **Where Everything Saves**

| Item | Location |
|---|---|
| **Character .blend files** | `Google Drive/MIB-Hub-Assets/characters/` |
| **Exported .glb files** | `Google Drive/MIB-Hub-Assets/exports/` |
| **Preview screenshots** | `Google Drive/MIB-Hub-Assets/screenshots/` |
| **Jiya reference photos** | `~/Downloads/IMG_8*.jpg` |
| **Session log** | `~/Downloads/MIB-Hub/.current_session.txt` |

---

## ⚠️ **If Something Goes Wrong**

### **Colab disconnects mid-session:**
1. Go back to Colab
2. Click the ▶️ button on Cell 6 only
3. Copy the NEW ngrok URL
4. In Claude chat, say: "Reconnect to [NEW_URL]"

### **Omniroute isn't starting:**
- Check if it's already running: `pgrep omniroute`
- Kill old instance: `pkill omniroute`
- Start fresh in a new terminal

### **Claude can't connect:**
1. Make sure Cell 6 in Colab is still running (spinning icon)
2. Test the URL manually: `curl https://YOUR_URL.ngrok-free.dev/mcp/health`
3. If offline, restart Cell 6 and get new URL

---

## 💡 **Pro Tips**

1. **Keep Colab awake:** Click in the Colab tab every ~30 minutes (Google disconnects idle sessions)
2. **GPU time limits:** Free Colab = ~12 hours/day. If you hit the limit, wait until tomorrow or upgrade to Colab Pro ($10/mo)
3. **Save the ngrok URL:** Each session gets a new URL, so save it somewhere if you need to reconnect
4. **Check Google Drive:** All your characters save permanently there — even if Colab disconnects, nothing is lost

---

## 🎯 **Today's Summary (What We Did)**

- ✅ Set up Google Colab with Blender 4.0 + GPU
- ✅ Installed MPFB2 character generator
- ✅ Created MCP server for remote control
- ✅ Made one-click startup script
- ✅ Saved Jiya's reference photos for next session
- ⏸️ **Paused here** — ready to generate characters next time!

---

## 📅 **Next Session Goals**

1. Generate Jiya (6 outfits: sports, pink dress, floral top, library outfit, casual, winter)
2. Generate 4 more characters (Mum, Dad, Bature, Firdausi)
3. Export all to `.glb` for PlayCanvas
4. Test one character in the game

**Estimated time:** 2-3 hours with GPU

---

## 🆘 **Quick Commands Reference**

```bash
# Start omniroute (separate terminal)
omniroute

# Run setup script
cd ~/Downloads/MIB-Hub
./start-colab-session.sh

# Start claude-personal
claude-personal

# Check if MCP is configured
cat ~/.cc/personal/.claude.json | grep blender-colab

# Remove old MCP config (if needed)
claude-personal mcp remove blender-colab
```

---

**Current Status (Nov 20, 11:49 PM):**
- ✅ All files ready for next session
- ✅ Jiya photos saved
- ✅ Colab notebook tested and working
- ✅ One-click script created
- 🌙 **Good stopping point!**

**See you next session! 🎨**
