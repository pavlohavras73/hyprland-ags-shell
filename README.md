# Hyprland + AGS desktop shell

Custom desktop shell for Hyprland built with AGS (Astal / GTK4 layer shell): bar, command palette, AI widget, RAM guardian,
semantic workspaces and a chat client for a personal assistant backend.

## Setup notes
- Copy to `~/.config/ags`. Needs `ags`, `astal` and `gtk4-layer-shell`.
- `preferences.json` -> `server_url`: point it at your own assistant webhook.
- Secrets (API tokens) are read from `~/.config/ags/secrets.json` via `services/secrets.ts`; that file is not part of
  the repository. Format: `{ "some_key": "value" }`.
- Generated GObject typings (`@girs`) are not included; generate them with `ags types`.
- `scripts/voice_stt.py` (voice input) runs with `python3`; install its dependencies in your environment or point the shebang at a venv.

## Status
Archived. The shell worked as my daily driver on Hyprland; I'm now building my setup on top of Omarchy instead.
