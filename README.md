# Minecraft Local Server Manager

I have build a desktop application for managing local Minecraft servers.  
Compatible with Vanilla, Paper, Spigot, Bukkit, Fabric, and Forge.

## Features

- Start/stop the server.
- Real-time CPU and RAM statistics.
- Real-time console with command history.
- Player management (kick, ban, op, gamemode).
- Whitelist and Banlist with visual editor.
- server.properties editor.
- Manual and automatic world backups.

## Requirements

- Java (JRE 17 or newer) installed, to run the Minecraft servers.
- Windows 10+ or a 64-bit Linux distribution.

## Download

Grab the latest release from the [releases page](https://github.com/hugoaldaHD/minecraft-local-server-app/releases/latest).

### Windows

Download `Minecraft-Local-Server-Manager.exe` and run the installer.

### Linux (x64)

- **AppImage** - `Minecraft-Local-Server-Manager.AppImage`: no installation needed.

  ```bash
  chmod +x Minecraft-Local-Server-Manager.AppImage
  ./Minecraft-Local-Server-Manager.AppImage
  ```

  The app registers itself as an installed app on first run, so it shows up in the
  application menu with its own icon.

- **Debian / Ubuntu** - `Minecraft-Local-Server-Manager.deb`:

  ```bash
  sudo apt install ./Minecraft-Local-Server-Manager.deb
  ```

  Updates for the `.deb` come from your package manager, not from the app.

## Notes

- The AppImage is self-contained and can update itself from inside the app.
- Server files, backups and settings are stored in `%APPDATA%\minecraft-local-server-app`
  on Windows and in `~/.config/minecraft-local-server-app` on Linux.

---