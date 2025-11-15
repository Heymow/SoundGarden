# Changelog - Collab Warz Cog

## [2025-11-15] - Red-DiscordBot Cog Structure

### Added
- **Red-DiscordBot Compatibility**: Restructured as a proper Red-DiscordBot cog
- **GitHub Installation**: Can now be installed directly from GitHub repository
- **Root Repository Manifest**: Added `info.json` for repo-level metadata
- **Cog Initialization**: Created `__init__.py` with proper setup function
- **Installation Guide**: Comprehensive `INSTALLATION.md` with troubleshooting
- **Quick Reference**: Added `REFERENCE.md` command reference card
- **Git Ignore**: Added `.gitignore` to prevent config file commits

### Changed
- **Folder Rename**: `discord-bot` → `collabwarz` (standard Red cog naming)
- **Documentation Updates**: Updated all docs with new installation instructions
- **QUICK_START.md**: Now includes 3 installation methods
- **README.md**: Added GitHub installation as recommended method

### Installation Methods Now Available

#### Method 1: GitHub Repository (Recommended)
```bash
[p]repo add soundgarden https://github.com/Heymow/SoundGarden
[p]cog install soundgarden collabwarz
[p]load collabwarz
```

#### Method 2: Manual Installation
Copy the `collabwarz` folder to Red's cogs directory and load.

#### Method 3: Interactive Wizard
Run `python install.py` for guided setup.

### Benefits
- ✅ One-command installation from GitHub
- ✅ Automatic updates via `[p]cog update collabwarz`
- ✅ Standard Red-DiscordBot structure
- ✅ Professional cog organization
- ✅ Complete documentation suite

### File Structure
```
collabwarz/
├── __init__.py            # Cog setup (NEW)
├── .gitignore            # Ignore configs (NEW)
├── INSTALLATION.md       # Install guide (NEW)
├── REFERENCE.md          # Quick reference (NEW)
├── CHANGELOG.md          # This file (NEW)
├── QUICK_START.md        # Updated
├── README.md             # Updated
├── collabwarz.py         # Main cog code
├── info.json             # Cog metadata
├── config_example.json   # Example config
├── install.py            # Interactive wizard
└── requirements.txt      # Dependencies
```

### Backward Compatibility
All existing functionality preserved. This is purely a structural change to make installation easier.

### Migration Notes
If you previously had this installed manually:
1. Unload the old cog: `[p]unload collabwarz`
2. Remove the old folder
3. Install using new method: `[p]repo add soundgarden ...`
4. Your configuration will be preserved (stored separately by Red)

### Next Release
See [README.md](README.md) for current features and [QUICK_START.md](QUICK_START.md) for usage.
