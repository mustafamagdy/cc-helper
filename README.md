# claudeprofile

A CLI tool for managing diffferent Claude provider profiles and configurations. Switch between Anthropic, zAI (Zhipu GLM), MiniMax, and OpenRouter profiles with ease.

![Main CLI](https://raw.githubusercontent.com/mustafamagdy/cc-helper/main/images/cli.png)

## Features

- Interactive TUI for profile management
- Support for multiple LLM providers:
  - **Anthropic** - Official Claude API
  - **zAI (Zhipu GLM)** - GLM models
  - **MiniMax** - MiniMax API
  - **OpenRouter** - Unified API for multiple providers
- Easy profile switching
- Custom configuration for API tokens, base URLs, and models

## Quick Start

Run directly without installation:

```bash
npx claudeprofile
# or
bunx claudeprofile
```

Or install globally:

```bash
npm install -g claudeprofile
claudeprofile
```

## Usage

Navigate the menu with:
- `↑/↓` or `j/k` - Navigate
- `Enter` - Select
- `Esc` or `q` - Back/Exit

### Menu Options

1. **Switch Profile** - Select a configured profile to use
2. **Configure** - Add or edit provider configurations
3. **List Profiles** - View all configured profiles

![Switch Profile](https://raw.githubusercontent.com/mustafamagdy/cc-helper/main/images/select-profile.png)


## Configuration

Profiles are stored in `~/.config/claudeprofile/profiles/` as JSON files.

### Example Profile Structure

```json
{
  "name": "My Provider",
  "provider": "zai",
  "auth_url": "https://z.ai/manage-apikey/apikey-list",
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-token-here",
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_MODEL": "GLM-4.7"
  }
}
```
![Configure Profiles](https://raw.githubusercontent.com/mustafamagdy/cc-helper/main/images/configure-profiles.png)

## Requirements

- Node.js 18+
- A terminal that supports ANSI colors

## License

MIT
