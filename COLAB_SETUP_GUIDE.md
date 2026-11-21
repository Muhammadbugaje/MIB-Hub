# Google Colab Setup Guide — MIB-Hub Asset Pipeline

## 🎯 What This Does

Uses **Google Colab's free GPU** + **Google Drive** to run Blender headlessly. Claude controls it remotely via MCP to generate your 50+ characters, buildings, and assets.

---

## ⚡ Quick Start (5 Minutes)

### **Step 1: Get ngrok Auth Token (Free)**

1. Go to https://ngrok.com/
2. Sign up (free account)
3. Go to https://dashboard.ngrok.com/get-started/your-authtoken
4. Copy your auth token (looks like: `2abc123XYZ_456def789GHI`) 
My own = 3AAm45UPC5zS4dhowPAqAe3n3uD_z4nXtGmLZb7LD8o63YZo

### **Step 2: Open the Colab Notebook**

1. Go to https://colab.research.google.com/
2. Click **File → Upload notebook**
3. Upload: `/Users/macbookair/Downloads/MIB-Hub/tools/COLAB_BLENDER_MCP_SETUP.ipynb`

### **Step 3: Set GPU Runtime**

1. Click **Runtime → Change runtime type**
2. Select **GPU** (T4)
3. Click **Save**

### **Step 4: Edit Cell 6 (Add Your ngrok Token)**

Find this line in **Cell 6**:
```python
ngrok.set_auth_token("YOUR_NGROK_AUTH_TOKEN")
```

Replace `YOUR_NGROK_AUTH_TOKEN` with your actual token:
```python
ngrok.set_auth_token("2abc123XYZ_456def789GHI")
```

### **Step 5: Run All Cells**

1. Click **Runtime → Run all**
2. When prompted, click **Connect to Google Drive** and authorize
3. Wait ~3 minutes for installation
4. **Cell 6** will print a URL like: `https://abc123.ngrok.io`

### **Step 6: Copy the URL**

The output will look like this:
```
================================================================================
🚀 MCP SERVER IS LIVE!
================================================================================

📡 Public URL: https://abc123.ngrok.io

📋 COPY THIS URL AND GIVE IT TO CLAUDE:

   https://abc123.ngrok.io

💻 On your LOCAL machine, run:
   claude mcp add --transport http blender-colab https://abc123.ngrok.io

⏳ Server will keep running until you stop this cell...

================================================================================
```

**Copy that URL** (e.g., `https://abc123.ngrok.io`)

### **Step 7: Connect Claude**

On your **local Mac** (where Claude Code runs), open Terminal and run:

```bash
claude mcp add --transport http blender-colab https://abc123.ngrok.io
```

(Replace with your actual ngrok URL)

### **Step 8: Confirm Connection**

Come back to this chat and say:

> **"MCP server connected at https://abc123.ngrok.io"**

Then I'll test the connection and start generating characters! 🎨

---

## 📂 Where Files Are Saved

All `.blend` files and exports save to:
```
Google Drive/MIB-Hub-Assets/
├── characters/       (50 character .blend files)
├── buildings/        (building assets, glass pyramid)
├── exports/          (optimized .glb files for PlayCanvas)
└── screenshots/      (character approval renders)
```

**These files persist forever** — they won't disappear when Colab session ends.

---

## 🔄 If Colab Disconnects

Google Colab free tier disconnects after ~12 hours. If that happens:

1. **Open the notebook again**
2. **Run Cell 6 only** (the MCP server cell)
3. **Copy the new ngrok URL** (it changes each time)
4. **Reconnect Claude** with the new URL:
   ```bash
   claude mcp add --transport http blender-colab https://NEW_URL.ngrok.io
   ```

All your files are still in Google Drive — nothing is lost!

---

## ⚠️ Troubleshooting

### "ngrok auth token" error
→ You need to add your auth token to Cell 6 (Step 4 above)

### "GPU not available"
→ Change runtime to GPU (T4) in Runtime menu

### "Drive mount failed"
→ Click the "Connect to Google Drive" popup and authorize

### "ModuleNotFoundError: No module named 'mpfb'"
→ Rerun Cell 3 (MPFB2 installation)

---

## 🚀 What Happens After Connection

Once you give me the ngrok URL, I will:

1. ✅ **Test connection** (send a simple cube script)
2. ✅ **Read CHARACTERS.md** (your 40+ character specs)
3. ✅ **Generate 30 base characters** using MPFB2
4. ✅ **Create 20 variations** (older, shorter, darker, etc.)
5. ✅ **Render T-pose screenshots** for your approval
6. ✅ **Add shape keys** (facial emotions + body morphs)
7. ✅ **Export optimized .glb files** for PlayCanvas
8. ✅ **Build the glass pyramid** for the map
9. ✅ **Fix building collisions**

All done on Colab's GPU — your local Mac does nothing! 💪

---

## 💰 Cost Breakdown

| Service | Free Tier | Paid Option |
|---|---|---|
| **Google Colab** | 12 hrs/day GPU | $10/mo unlimited |
| **ngrok** | 1 tunnel, unlimited time | Free is enough |
| **Google Drive** | 15 GB free | $2/mo for 100GB |

**Total:** $0/mo (or $10/mo for unlimited GPU time)

---

## 📋 Backup Options (If Colab Limits Hit)

### **Loopcut** (Quick 3D Assets)
If we hit Colab's daily limit, we can use Loopcut for quick asset generation:
- Website: https://loopcut.ai
- Good for: Building models, props, simple characters
- I can guide you through API integration

### **JANCTION Render** (Fast Screenshot Renders)
For batch rendering 50 character screenshots:
```bash
claude mcp add --transport http janction-render https://render.janction.jp/mcp
```
- 10-minute job limit
- Perfect for: "Render these 10 characters, front view"
- I switch to JANCTION automatically if Colab is slow

---

## ✅ Ready to Start?

1. Upload the notebook to Colab
2. Add your ngrok token
3. Run all cells
4. Give me the ngrok URL

Then we'll generate all 50 characters in one session! 🎨🚀
