#!/usr/bin/env bash
# Theme Switcher for AGS Shell & Hyprland
# Usage:
#   theme-switch.sh generate [wallpaper_path]   -> Runs Matugen & applies Material You palette
#   theme-switch.sh default                     -> Instant rollback to Stitch Black & Red

AGS_DIR="$HOME/.config/ags"
MATUGEN_BIN="$HOME/.local/bin/matugen"

export GI_TYPELIB_PATH="/usr/local/lib/x86_64-linux-gnu/girepository-1.0:$GI_TYPELIB_PATH"

if [ -z "$HYPRLAND_INSTANCE_SIGNATURE" ]; then
    export HYPRLAND_INSTANCE_SIGNATURE=$(ls -t /run/user/1000/hypr 2>/dev/null | head -n 1)
fi


reload_ags() {
    ags quit 2>/dev/null
    pkill -9 -f "ags run" 2>/dev/null
    pkill -9 -f "gjs -m" 2>/dev/null
    sleep 0.5
    nohup ags run "$AGS_DIR" > /tmp/ags.log 2>&1 &
    disown
}


ACTION="${1:-generate}"
WALLPAPER_PATH="$2"

if [ "$ACTION" = "default" ] || [ "$ACTION" = "reset" ]; then
    echo "Reverting to default Black & Red theme..."
    cp "$AGS_DIR/colors-default.scss" "$AGS_DIR/colors-active.scss"
    
    # Reset Hyprland border colors to default Black & Red
    hyprctl keyword general:col.active_border "rgba(ff2d44ee) rgba(ff003cee) 45deg" 2>/dev/null
    hyprctl keyword general:col.inactive_border "rgba(ff2d4422)" 2>/dev/null
    
    reload_ags
    
    echo "Successfully reverted to default theme!"
    exit 0
fi

# Determine wallpaper path if not provided
if [ -z "$WALLPAPER_PATH" ]; then
    WALLPAPER_PATH=$(grep -E '^\$wallpaper\s*=\s*' "$HOME/.config/hypr/hyprpaper.conf" | cut -d '=' -f2 | tr -d ' ' | sed "s|~|$HOME|")
fi

if [ ! -f "$WALLPAPER_PATH" ]; then
    echo "Wallpaper file not found: $WALLPAPER_PATH"
    exit 1
fi

echo "Generating Material You theme from wallpaper: $WALLPAPER_PATH"

if [ ! -x "$MATUGEN_BIN" ]; then
    MATUGEN_BIN=$(which matugen 2>/dev/null)
fi

if [ -z "$MATUGEN_BIN" ]; then
    echo "Error: matugen binary not found!"
    exit 1
fi

# Run Matugen
"$MATUGEN_BIN" image "$WALLPAPER_PATH" --prefer=saturation

# Copy generated colors to active colors
if [ -f "$AGS_DIR/colors-generated.scss" ]; then
    cp "$AGS_DIR/colors-generated.scss" "$AGS_DIR/colors-active.scss"
fi

# Apply Hyprland border colors if generated
if [ -f "$HOME/.config/hypr/colors-generated.conf" ]; then
    ACTIVE_BORDER=$(grep '^\$activeBorderColor' "$HOME/.config/hypr/colors-generated.conf" | cut -d '=' -f2-)
    INACTIVE_BORDER=$(grep '^\$inactiveBorderColor' "$HOME/.config/hypr/colors-generated.conf" | cut -d '=' -f2-)
    if [ -n "$ACTIVE_BORDER" ]; then
        hyprctl keyword general:col.active_border "$ACTIVE_BORDER" 2>/dev/null
    fi
    if [ -n "$INACTIVE_BORDER" ]; then
        hyprctl keyword general:col.inactive_border "$INACTIVE_BORDER" 2>/dev/null
    fi
fi

reload_ags

echo "Material You theme applied successfully!"
