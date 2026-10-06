# ComfyUI Extended LoRA Loader

Custom nodes for **ComfyUI** that extend the standard `Load LoRA (Model Only)` functionality: a compact side-preview loader for single LoRAs and a multi-loader with support for **block-weight presets via JSON**, descriptions, trigger words, cover images, and quick links to source pages.

![ComfyUI](https://img.shields.io/badge/ComfyUI-Custom%20Node-green)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ Features

### 🔹 `Load LoRA Model (Compact Side-Preview)`
A compact single-LoRA loader:
- **Side preview**: LoRA cover image (`.png` / `.jpg` / `.webp`) displayed directly inside the node
- **Quick source link**: click the preview to open the URL from a matching `.url` shortcut file
- **Description and trigger fields** right in the node UI
- **Resizable** — drag the node to resize, and the preview and text areas adapt
- **Mouse wheel** works correctly inside textareas without hijacking canvas zoom

### 🔹 `Load LoRA Model (Multi)`
A multi-loader that stacks several LoRAs at once:
- **Unlimited LoRA list** with add, remove, move up/down controls
- **Enable/disable checkbox** per LoRA entry
- **Individual descriptions and trigger words** for each LoRA
- **Shared notes area** for the whole stack
- **Covers and source links** — same as the single loader
- **🔥 Block Weight Presets** — per-block LoRA strength scaling via JSON presets
- **`text_prompt` output** with all trigger words combined, ready to feed into CLIP Text Encode

---

## 🚀 Installation

### Manual install
1. Navigate to your ComfyUI `custom_nodes` folder:
   ```
   ComfyUI/custom_nodes/
   ```
2. Clone the repository (or extract the archive):
   ```bash
   git clone https://github.com/YOUR_USERNAME/ComfyUI-Extended-Lora-Loader.git
   ```
   This will create the folder:
   ```
   ComfyUI/custom_nodes/ComfyUI-Extended-Lora-Loader/
   ```
3. Restart ComfyUI.
4. Refresh your browser page with cache clear: **Ctrl + F5**.

### Via ComfyUI Manager
Search for `ComfyUI Extended LoRA Loader` and click **Install**.

> ⚠️ **No additional Python packages are required.** The extension relies entirely on modules already shipped with ComfyUI — no `pip install` needed.

---

## 📖 Usage

### Single Loader
Simply add the `Load LoRA Model (Compact Side-Preview)` node and select a LoRA. The description, triggers, and preview will appear automatically if the corresponding files exist next to the `.safetensors` file.

### Multi Loader
Add the `Load LoRA Model (Multi)` node:
- **`+ Add LoRA`** — add a new entry
- **`Refresh LoRA list`** — refresh the list of available LoRAs
- **`Refresh block presets`** — refresh the preset list from JSON
- **`↑ / ↓`** — move a LoRA up or down in the list
- **`✕`** — remove the entry
- **Checkbox** — enable/disable a LoRA without deleting it

Each entry contains:
| Field | Purpose |
|-------|---------|
| `enabled` | Enable/disable this LoRA |
| `lora_name` | LoRA file name |
| `strength_model` | Base strength (same as the standard node) |
| `block_weight_preset` | Block weight preset to apply |
| `description` | Notes about this LoRA |
| `triggers` | Trigger words (appended to the output `text_prompt`) |

---

## 🎚️ Block Weight Presets

This is the key feature of the multi-loader. It allows applying **different strength values to different model blocks** (input/middle/output blocks of UNet, double/single blocks of Flux-like architectures, etc.).

> 📦 The repository already ships with a ready-to-use set of presets in `block_weight_presets.json`, so you can start experimenting with block weights right away — no manual setup needed.

### How it works

Each LoRA can have its own preset:

```
final block strength = strength_model × block_weight_from_preset
```

For example, if a LoRA has:
- `strength_model = 0.8`
- preset `[1.0, 0.5, 0.2]`

Then the blocks will receive strengths: `0.8`, `0.4`, `0.16` respectively.

### Preset file

Presets are stored in `block_weight_presets.json` next to `__init__.py`:

```json
[
  {
    "name": "None",
    "weights": []
  },
  {
    "name": "SDXL - Full",
    "weights": [
      1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0
    ]
  },
  {
    "name": "SDXL - Low blocks weak",
    "weights": [0.3, 0.5, 0.7, 0.9, 1.0, 1.0, 1.0]
  },
  {
    "name": "SD15 - Soft",
    "weights": [0.8, 0.9, 1.0, 1.0]
  }
]
```

**The model type is indicated directly in the preset name** — for example `SDXL - ...`, `Pony - ...`, `Flux - ...`. The user selects the appropriate preset manually.

### Special preset `None`
Means "do not apply block weights" — the standard loading with only `strength_model` is used.

### Safety rules
If something goes wrong with the JSON, the node will not break:
- File missing → behaves as `None`
- Broken JSON → behaves as `None`
- Preset not found → behaves as `None`
- Fewer weights than blocks → missing values are treated as `1.0`
- More weights than blocks → extra values are ignored
- Non-numeric value → replaced with `1.0`

### Refresh presets without restart
After editing `block_weight_presets.json`, click the **`Refresh block presets`** button in the node — new presets will be loaded without restarting ComfyUI.

---

## 🖼️ Covers & Links

For each LoRA, you can place two companion files next to the `.safetensors`:

| File | Purpose |
|------|---------|
| `my_lora.png` (or `.jpg` / `.webp`) | Cover image shown in the preview |
| `my_lora.url` | Windows shortcut with a source URL; clicking the preview opens it in the browser |

Example `my_lora.url`:
```
[InternetShortcut]
URL=https://civitai.com/models/12345/my-lora
```

---

## 📁 Project Structure

```
ComfyUI-Extended-Lora-Loader/
├── __init__.py                      # Backend: nodes + API endpoints
├── block_weight_presets.json        # Block weight presets (pre-populated)
├── web/
│   └── lora_preview.js              # Frontend: node UI
└── README.md
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/custom_ext/get_lora_cover?name=...` | GET | Returns the LoRA cover image |
| `/custom_ext/get_lora_link?name=...`  | GET | Returns the URL from the `.url` file |
| `/custom_ext/get_block_weight_presets` | GET | Returns the list of preset names |

---

## ⚙️ Supported Architectures (Block Weight)

Block mapping is determined heuristically from key names in the LoRA file. Supported patterns:

- **UNet-like** (SD1.5 / SDXL): `input_blocks` → `middle_block` → `output_blocks`
- **U-Net alt**: `down_blocks` → `mid_block` → `up_blocks`
- **Flux-like**: `double_blocks` → `single_blocks`
- **Joint blocks**: `joint_blocks`
- **Transformer blocks**: `blocks` / `transformer_blocks`

Keys that do not belong to any block (e.g. `time_embed`, `conv_in`, text encoder) receive the base `strength_model`.

---

## 🧪 Example Preset Pack

Below is an example of what `block_weight_presets.json` may contain. The actual file bundled with the repository already includes a similar set of presets.

```json
[
  { "name": "None", "weights": [] },

  { "name": "SDXL - Full (28)", "weights": [
    1,1,1,1,1,1,1, 1,1,1,1,1,1,1,
    1,1,1,1,1,1,1, 1,1,1,1,1,1,1
  ]},

  { "name": "SDXL - Style focus", "weights": [
    0.4, 0.6, 0.8, 1.0, 1.0, 1.0, 1.0
  ]},

  { "name": "SDXL - Detail focus", "weights": [
    1.0, 1.0, 1.0, 1.0, 0.8, 0.6, 0.4
  ]},

  { "name": "SD15 - Character soft", "weights": [
    0.7, 0.8, 0.9, 1.0, 1.0, 1.0
  ]},

  { "name": "Flux - Balanced (19+38)", "weights": [
    1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 1.0,
    0.9, 0.9, 0.9, 0.9, 0.9,
    0.9, 0.9, 0.9, 0.9, 0.9
  ]}
]
```

---

## 🛠️ Requirements

- ComfyUI (up-to-date version)
- Python 3.10+

> ✅ **No additional Python libraries required.** The extension uses only built-in ComfyUI modules (`aiohttp`, `folder_paths`, `nodes`, `server`) — no `pip install` or `requirements.txt` needed.

---

## 📝 Notes

- The nodes inherit from `LoraLoaderModelOnly` and work **with the MODEL output only** (no CLIP). If you need CLIP, use the standard `Load LoRA` node.
- The `text_prompt` output collects all trigger words into a single text — convenient for passing to `CLIP Text Encode`.
- When updating via `git pull`, your custom `block_weight_presets.json` will not be overwritten unless you force it.

---

## 📜 License

MIT — use, modify, share.

---

## 🙌 Credits

> This extension, including its code and GitHub presentation, was created with the assistance of **Qwen3.8-Max**.

If you find this extension useful, please give it a ⭐ on GitHub!