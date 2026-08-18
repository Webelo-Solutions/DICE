; Inno Setup script for DICE — builds DICE-Setup.exe
; Prereq: run `npm run build:release` and place a Windows x64 node.exe in
; release\app (see INSTALL_BUILD.md). Then compile this script with Inno Setup.

#define AppName "DICE"
; AppVersion is generated from package.json by `npm run build:release` into
; installer/version.iss — single source of truth. If you ever compile without
; running build:release first, write a one-line version.iss containing e.g.
; `#define AppVersion "1.1.0"`.
#include "version.iss"
#define AppPublisher "Webelo Solutions"
#define AppExe "DICE.cmd"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
; Stamp the installer .exe itself with the version so right-click → Properties →
; Details shows it (and Windows reports a usable Product Version everywhere).
VersionInfoVersion={#AppVersion}
VersionInfoProductVersion={#AppVersion}
VersionInfoProductName={#AppName}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} {#AppVersion} Installer
; Per-user install: no admin prompt, friendlier for website distribution.
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=..\release\installer
; Embeds the version (sourced from package.json via installer/version.iss) into
; the filename — each release produces a single, version-named artifact, e.g.
; DICE-Setup-1.2.0.exe.
OutputBaseFilename=DICE-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
; node.exe and better-sqlite3 are 64-bit.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
; Icon for the installer .exe itself (shortcuts use {app}\dice.ico, shipped via build:release).
SetupIconFile=dice.ico

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Files]
; The entire assembled payload from `npm run build:release` (+ node.exe you added).
Source: "..\release\app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}";        Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\dice.ico"
; LAN host: same app, but reachable by other devices on a trusted local network.
Name: "{group}\{#AppName} (LAN Host)"; Filename: "{app}\DICE-LAN.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\dice.ico"
; Public internet host: Let's Encrypt certificate for a real domain. Requires
; editing DICE-Internet.cmd first — it refuses to start on the placeholder
; domain rather than failing obscurely against the ACME rate limits.
Name: "{group}\{#AppName} (Secure Internet Host)"; Filename: "{app}\DICE-Internet.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\dice.ico"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#AppName}";  Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; IconFilename: "{app}\dice.ico"; Tasks: desktopicon

[Run]
; Offer to launch right after install.
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove the install dir contents; user data in %LOCALAPPDATA%\DICE is intentionally
; left in place so reinstalling preserves saved rosters/campaigns. Delete it manually
; (or via the note in INSTALL_BUILD.md) for a full wipe.
Type: filesandordirs; Name: "{app}\node_modules"
