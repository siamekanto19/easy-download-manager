#!/bin/bash
set -e

APP_NAME="Easy Download Manager"
DMG_NAME="EasyDownloadManager"
APP_PATH="build/bin/${APP_NAME}.app"
DMG_PATH="build/bin/${DMG_NAME}.dmg"
DMG_TEMP="build/bin/${DMG_NAME}-temp.dmg"
VOL_NAME="${APP_NAME}"
STAGING="/tmp/dmg-staging"

echo "═══════════════════════════════════════"
echo "  Building ${APP_NAME} DMG"
echo "═══════════════════════════════════════"

# Step 1: Build the app
echo ""
echo "▶ Building application..."
wails build
echo "✅ Build complete"

# Step 2: Prepare staging area
echo ""
echo "▶ Preparing DMG staging..."
rm -rf "${STAGING}"
mkdir -p "${STAGING}"
cp -R "${APP_PATH}" "${STAGING}/"
ln -s /Applications "${STAGING}/Applications"

# Step 3: Create a temporary writable DMG
echo ""
echo "▶ Creating DMG..."
rm -f "${DMG_TEMP}" "${DMG_PATH}"
hdiutil create -volname "${VOL_NAME}" \
  -srcfolder "${STAGING}" \
  -fs HFS+ \
  -fsargs "-c c=64,a=16,e=16" \
  -format UDRW \
  -size 200m \
  "${DMG_TEMP}"

# Step 4: Mount and customize with AppleScript
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "${DMG_TEMP}" | egrep '^/dev/' | sed 1q | awk '{print $1}')
MOUNT_POINT="/Volumes/${VOL_NAME}"

echo ""
echo "▶ Customizing DMG layout..."

# Set window properties via AppleScript
osascript <<APPLESCRIPT
tell application "Finder"
  tell disk "${VOL_NAME}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {100, 100, 640, 440}
    set viewOptions to icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 80
    set position of item "${APP_NAME}.app" of container window to {140, 170}
    set position of item "Applications" of container window to {400, 170}
    close
    open
    update without registering applications
    delay 2
  end tell
end tell
APPLESCRIPT

# Set the volume icon
if [ -f "build/appicon.png" ]; then
  cp "build/appicon.png" "${MOUNT_POINT}/.VolumeIcon.icns" 2>/dev/null || true
  SetFile -a C "${MOUNT_POINT}" 2>/dev/null || true
fi

sync
hdiutil detach "${DEVICE}"

# Step 5: Compress to final DMG
echo ""
echo "▶ Compressing final DMG..."
hdiutil convert "${DMG_TEMP}" -format UDZO -imagekey zlib-level=9 -o "${DMG_PATH}"
rm -f "${DMG_TEMP}"
rm -rf "${STAGING}"

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ DMG created: ${DMG_PATH}"
echo "═══════════════════════════════════════"
echo ""
ls -lh "${DMG_PATH}"
