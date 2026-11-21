#!/bin/bash
# MIB-Hub: One-Click Claude + Colab Setup
# Run this script to start a new character generation session

set -e

echo "════════════════════════════════════════════════════════════════"
echo "🚀 MIB-Hub Character Pipeline - Session Startup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# Step 1: Check if omniroute is running
# ============================================================================

echo "📡 Step 1: Checking omniroute server..."

if ! pgrep -f "omniroute" > /dev/null; then
    echo "⚠️  omniroute not running. Starting it now..."
    echo "   (If this fails, start omniroute manually in another terminal)"
    echo ""
    # Try to start omniroute (adjust path if needed)
    # omniroute &
    # sleep 2
else
    echo "✅ omniroute is already running"
fi

echo ""

# ============================================================================
# Step 2: Prompt user to start Google Colab
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "📓 Step 2: Start Google Colab"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. Open: https://colab.research.google.com/"
echo "2. Upload: ~/Downloads/MIB-Hub/tools/COLAB_BLENDER_MCP_SETUP_FIXED.ipynb"
echo "3. Set Runtime: GPU (T4)"
echo "4. Run all cells (Runtime → Run all)"
echo "5. Wait for Cell 6 to print the ngrok URL"
echo ""
echo "Press ENTER when Colab is ready and Cell 6 is running..."
read -r

echo ""

# ============================================================================
# Step 3: Get ngrok URL from user
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "🔗 Step 3: Connect to Colab MCP Server"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Copy the ngrok URL from Colab Cell 6 output."
echo "It looks like: https://something-something.ngrok-free.dev"
echo ""
read -p "Paste ngrok URL here: " NGROK_URL

# Clean up URL (remove quotes, extra text)
NGROK_URL=$(echo "$NGROK_URL" | sed 's/.*https/https/' | sed 's/".*//' | tr -d ' ')

if [[ ! "$NGROK_URL" =~ ^https://.*ngrok.*\.dev$ ]]; then
    echo "❌ Invalid URL format. Expected: https://....ngrok-free.dev"
    exit 1
fi

echo ""
echo "✅ URL received: $NGROK_URL"
echo ""

# ============================================================================
# Step 4: Add MCP server to claude-personal config
# ============================================================================

echo "📝 Step 4: Configuring claude-personal MCP connection..."
echo ""

# Add the MCP server
claude-personal mcp add --transport http blender-colab "$NGROK_URL"

if [ $? -eq 0 ]; then
    echo "✅ MCP server 'blender-colab' added successfully!"
else
    echo "⚠️  Failed to add MCP server (might already exist)"
    echo "   Continuing anyway..."
fi

echo ""

# ============================================================================
# Step 5: Create session info file
# ============================================================================

SESSION_FILE="$HOME/Downloads/MIB-Hub/.current_session.txt"
cat > "$SESSION_FILE" << EOF
MIB-Hub Character Pipeline Session
Started: $(date)
Ngrok URL: $NGROK_URL
Status: Ready for character generation

Quick Reference:
- Jiya photos: ~/Downloads/IMG_8*.jpg
- Google Drive: Google Drive/MIB-Hub-Assets/
- Colab notebook: Running with GPU (T4)
EOF

echo "💾 Session info saved to: $SESSION_FILE"
echo ""

# ============================================================================
# Done!
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎨 You can now start claude-personal and say:"
echo "   \"MCP connected at $NGROK_URL\""
echo ""
echo "   Then I'll start generating Jiya and other characters!"
echo ""
echo "📂 Character references ready:"
echo "   - Jiya: ~/Downloads/IMG_8*.jpg"
echo "   - Game specs: ~/Downloads/MIB-Hub/CHARACTERS.md"
echo ""
echo "════════════════════════════════════════════════════════════════"
