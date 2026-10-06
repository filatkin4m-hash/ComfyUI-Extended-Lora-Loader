import os
import re
import json
import folder_paths
from aiohttp import web
from nodes import LoraLoaderModelOnly
from server import PromptServer

try:
    import comfy.utils
    import comfy.lora
except Exception:
    comfy = None

CUSTOM_EXT_DIR = os.path.dirname(os.path.abspath(__file__))
BLOCK_WEIGHT_PRESETS_FILE = os.path.join(CUSTOM_EXT_DIR, "block_weight_presets.json")


def _normalize_preset_weights(value):
    if value is None:
        return []

    if isinstance(value, str):
        parts = [p.strip() for p in value.split(",") if p.strip() != ""]
        values = []
        for p in parts:
            try:
                values.append(float(p))
            except Exception:
                values.append(1.0)
        return values

    if isinstance(value, (list, tuple)):
        values = []
        for v in value:
            try:
                values.append(float(v))
            except Exception:
                values.append(1.0)
        return values

    return []


def load_block_weight_presets():
    """
    Возвращает:
        names: список имён пресетов для UI
        mapping: {имя: [веса]}
    """
    names = ["None"]
    mapping = {"None": []}

    try:
        if os.path.exists(BLOCK_WEIGHT_PRESETS_FILE):
            with open(BLOCK_WEIGHT_PRESETS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

            if isinstance(data, dict):
                items = []
                for k, v in data.items():
                    if isinstance(k, str):
                        items.append({"name": k, "weights": v})
            elif isinstance(data, list):
                items = data
            else:
                items = []

            for item in items:
                name = ""
                weights_raw = []

                if isinstance(item, dict):
                    name = str(item.get("name", "")).strip()
                    weights_raw = item.get("weights", [])
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    name = str(item[0]).strip()
                    weights_raw = item[1]

                if not name:
                    continue

                if name.lower() == "none":
                    continue

                weights = _normalize_preset_weights(weights_raw)

                if name not in mapping:
                    mapping[name] = weights
                    names.append(name)

    except Exception as e:
        print(f"[ExtendedLoraLoaderMulti] Failed to load block weight presets: {e}")

    return names, mapping


class ExtendedLoraLoaderSingle(LoraLoaderModelOnly):
    CATEGORY = "loaders/custom"

    @classmethod
    def INPUT_TYPES(s):
        orig_types = LoraLoaderModelOnly.INPUT_TYPES()
        orig_types["required"]["description"] = ("STRING", {"default": "", "multiline": True})
        orig_types["required"]["triggers"] = ("STRING", {"default": "", "multiline": True})

        if "optional" not in orig_types:
            orig_types["optional"] = {}

        orig_types["optional"]["text_prompt"] = ("STRING", {"forceInput": True, "default": ""})
        return orig_types

    RETURN_TYPES = ("MODEL", "STRING")
    RETURN_NAMES = ("MODEL", "text_prompt")
    FUNCTION = "load_lora_extended"

    def load_lora_extended(self, model, lora_name, strength_model, description, triggers, text_prompt=""):
        patched_model, _ = super().load_lora(
            model=model,
            clip=None,
            lora_name=lora_name,
            strength_model=strength_model,
            strength_clip=0.0,
        )

        cleaned_triggers = str(triggers).strip() if triggers else ""
        if cleaned_triggers in ("[object Object]", "undefined"):
            cleaned_triggers = ""

        cleaned_prompt = text_prompt.strip() if text_prompt else ""

        if cleaned_triggers:
            out_prompt = f"{cleaned_prompt}\n{cleaned_triggers}" if cleaned_prompt else cleaned_triggers
        else:
            out_prompt = cleaned_prompt

        return (patched_model, out_prompt)


class ExtendedLoraLoaderMulti(LoraLoaderModelOnly):
    CATEGORY = "loaders/custom"

    # Эвристика для определения блоков.
    # Порядок для UNet-подобных моделей:
    # input/down blocks -> middle/mid block -> output/up blocks
    #
    # Для double/single-архитектур:
    # double_blocks -> single_blocks
    _BLOCK_PATTERNS = [
        (
            "in",
            re.compile(
                r"(?:^|\.)(?:input_blocks|down_blocks|encoder_down_blocks|control_model\.input_blocks)\.(\d+)"
            ),
            True,
        ),
        (
            "mid",
            re.compile(r"(?:^|\.)(?:middle_block|mid_block)(?:\.|$)"),
            False,
        ),
        (
            "out",
            re.compile(
                r"(?:^|\.)(?:output_blocks|up_blocks|decoder_up_blocks|control_model\.output_blocks)\.(\d+)"
            ),
            True,
        ),
        (
            "double",
            re.compile(r"(?:^|\.)(?:double_blocks)\.(\d+)"),
            True,
        ),
        (
            "single",
            re.compile(r"(?:^|\.)(?:single_blocks)\.(\d+)"),
            True,
        ),
        (
            "joint",
            re.compile(r"(?:^|\.)(?:joint_blocks)\.(\d+)"),
            True,
        ),
        (
            "blocks",
            re.compile(r"(?:^|\.)(?:blocks|transformer_blocks)\.(\d+)"),
            True,
        ),
    ]

    @classmethod
    def INPUT_TYPES(s):
        orig_types = LoraLoaderModelOnly.INPUT_TYPES()

        loras = [""]
        try:
            loras += [x for x in folder_paths.get_filename_list("loras") if isinstance(x, str) and x]
        except Exception:
            pass

        required = {
            "model": orig_types["required"]["model"],
            "lora_template": (loras, {"default": ""}),
            "lora_list": ("STRING", {"default": "[]", "multiline": True}),
        }

        optional = {}
        if "optional" in orig_types:
            optional.update(orig_types["optional"])

        optional["text_prompt"] = ("STRING", {"forceInput": True, "default": ""})

        return {
            "required": required,
            "optional": optional,
        }

    RETURN_TYPES = ("MODEL", "STRING")
    RETURN_NAMES = ("MODEL", "text_prompt")
    FUNCTION = "load_lora_multi_extended"

    def _clean_text(self, value):
        value = str(value).strip() if value is not None else ""
        if value in ("[object Object]", "undefined", "null"):
            return ""
        return value

    def _parse_lora_list(self, raw_value):
        if not raw_value:
            return []

        if isinstance(raw_value, list):
            return raw_value

        if isinstance(raw_value, dict):
            return []

        try:
            parsed = json.loads(raw_value)
        except Exception:
            return []

        if not isinstance(parsed, list):
            return []

        return parsed

    def _is_block_preset_disabled(self, preset_name):
        name = self._clean_text(preset_name)
        if not name:
            return True
        return name.lower() in {"none", "off", "disable", "disabled"}

    def _get_block_weight(self, weights, index):
        try:
            if isinstance(weights, (list, tuple)) and index < len(weights):
                return float(weights[index])
        except Exception:
            pass
        return 1.0

    def _classify_block_key(self, key):
        """
        Возвращает (категория, номер блока) или None.
        Например:
            ("in", 0)
            ("mid", 0)
            ("out", 3)
        """
        k = str(key)

        for category, pattern, numbered in self._BLOCK_PATTERNS:
            m = pattern.search(k)
            if m:
                if numbered:
                    try:
                        return (category, int(m.group(1)))
                    except Exception:
                        return (category, 0)
                return (category, 0)

        return None

    def _ordered_block_groups(self, groups):
        """
        Сортирует группы блоков так, чтобы им можно было присвоить индексы 0..N.
        """
        groups = list(groups)
        if not groups:
            return []

        cats = {g[0] for g in groups}

        if cats & {"in", "out"}:
            priority = {"in": 0, "mid": 1, "out": 2}
        elif cats & {"double", "single"}:
            priority = {"double": 0, "single": 1}
        elif cats & {"joint"}:
            priority = {"joint": 0}
        elif cats & {"mid"}:
            priority = {"mid": 0}
        else:
            priority = {"blocks": 0}

        return sorted(
            groups,
            key=lambda g: (
                priority.get(g[0], 999),
                g[1],
                g[0],
            ),
        )

    def _standard_load_lora(self, model, lora_name, strength_model):
        patched_model, _ = super().load_lora(
            model=model,
            clip=None,
            lora_name=lora_name,
            strength_model=strength_model,
            strength_clip=0.0,
        )
        return patched_model

    def _load_lora_with_block_weights(self, model, lora_name, strength_model, weights):
        """
        Пытается применить LoRA с поблочными весами.
        Если что-то идёт не так — падает в стандартную загрузку.
        """
        if comfy is None or not weights:
            return self._standard_load_lora(model, lora_name, strength_model)

        try:
            full_lora_path = folder_paths.get_full_path("loras", lora_name)
            if not full_lora_path or not os.path.exists(full_lora_path):
                raise ValueError(f"LoRA not found: {lora_name}")

            lora_data = comfy.utils.load_torch_file(full_lora_path, safe_load=True)

            key_map = comfy.lora.model_lora_keys_unet(model.model, {})
            loaded = comfy.lora.load_lora(lora_data, key_map)

            if not loaded:
                return self._standard_load_lora(model, lora_name, strength_model)

            new_model = model.clone()

            groups = {}
            for key in loaded.keys():
                group = self._classify_block_key(key)
                if group is not None:
                    groups.setdefault(group, []).append(key)

            ordered_groups = self._ordered_block_groups(groups.keys())
            used_keys = set()

            for idx, group in enumerate(ordered_groups):
                keys = groups.get(group, [])
                if not keys:
                    continue

                block_weight = self._get_block_weight(weights, idx)

                try:
                    patch_strength = float(strength_model) * float(block_weight)
                except Exception:
                    patch_strength = float(strength_model)

                if abs(patch_strength) < 1e-8:
                    used_keys.update(keys)
                    continue

                subset = {k: loaded[k] for k in keys if k not in used_keys}
                if subset:
                    new_model.add_patches(subset, patch_strength)
                    used_keys.update(subset.keys())

            remaining = [k for k in loaded.keys() if k not in used_keys]
            if remaining:
                try:
                    base_strength = float(strength_model)
                except Exception:
                    base_strength = 1.0

                if abs(base_strength) > 1e-8:
                    subset = {k: loaded[k] for k in remaining}
                    new_model.add_patches(subset, base_strength)

            return new_model

        except Exception as e:
            print(
                f"[ExtendedLoraLoaderMulti] Block-weight loading failed for '{lora_name}': {e}. "
                "Falling back to standard LoRA loading."
            )
            return self._standard_load_lora(model, lora_name, strength_model)

    def load_lora_multi_extended(self, model, lora_template="", lora_list="[]", text_prompt=""):
        current_model = model
        prompt_parts = []

        cleaned_prompt = self._clean_text(text_prompt)
        if cleaned_prompt:
            prompt_parts.append(cleaned_prompt)

        entries = self._parse_lora_list(lora_list)

        # Читаем пресеты каждый раз, чтобы подхватывать правки JSON без перезапуска.
        _, preset_mapping = load_block_weight_presets()

        for entry in entries:
            if not isinstance(entry, dict):
                continue

            enabled = entry.get("enabled", True)
            if isinstance(enabled, str):
                enabled = enabled.strip().lower() not in ("false", "0", "no", "off")

            lora_name = self._clean_text(entry.get("lora_name", ""))
            if not enabled or not lora_name:
                continue

            try:
                strength_model = float(entry.get("strength_model", 1.0))
            except Exception:
                strength_model = 1.0

            full_lora_path = folder_paths.get_full_path("loras", lora_name)
            if not full_lora_path or not os.path.exists(full_lora_path):
                raise ValueError(f"ExtendedLoraLoaderMulti: LoRA not found: {lora_name}")

            preset_name = self._clean_text(entry.get("block_weight_preset", "None"))

            if self._is_block_preset_disabled(preset_name):
                current_model = self._standard_load_lora(
                    model=current_model,
                    lora_name=lora_name,
                    strength_model=strength_model,
                )
            else:
                weights = preset_mapping.get(preset_name, [])
                if not weights:
                    current_model = self._standard_load_lora(
                        model=current_model,
                        lora_name=lora_name,
                        strength_model=strength_model,
                    )
                else:
                    current_model = self._load_lora_with_block_weights(
                        model=current_model,
                        lora_name=lora_name,
                        strength_model=strength_model,
                        weights=weights,
                    )

            triggers = self._clean_text(entry.get("triggers", ""))
            if triggers:
                prompt_parts.append(triggers)

        return (current_model, "\n".join(prompt_parts))


@PromptServer.instance.routes.view("/custom_ext/get_lora_cover")
class GetLoraCoverEndpoint(web.View):
    async def get(self):
        lora_name = self.request.query.get("name", "")
        if not lora_name:
            return web.Response(status=400, text="Missing 'name'")

        lora_name = os.path.normpath(lora_name.replace("\\", "/"))
        full_lora_path = folder_paths.get_full_path("loras", lora_name)

        if not full_lora_path or not os.path.exists(full_lora_path):
            return web.Response(status=404, text="LoRA not found")

        clean_base_path = os.path.splitext(full_lora_path)[0]
        possible_extensions = [".png", ".jpg", ".jpeg", ".webp", ".PNG", ".JPG", ".JPEG", ".WEBP"]

        for ext in possible_extensions:
            img_path = clean_base_path + ext
            if os.path.exists(img_path):
                return web.FileResponse(img_path)

        return web.Response(status=404, text="No cover")


@PromptServer.instance.routes.view("/custom_ext/get_lora_link")
class GetLoraLinkEndpoint(web.View):
    async def get(self):
        lora_name = self.request.query.get("name", "")
        if not lora_name:
            return web.Response(status=400, text="Missing 'name'")

        lora_name = os.path.normpath(lora_name.replace("\\", "/"))
        full_lora_path = folder_paths.get_full_path("loras", lora_name)

        if not full_lora_path or not os.path.exists(full_lora_path):
            return web.Response(status=404, text="LoRA not found")

        clean_base_path = os.path.splitext(full_lora_path)[0]
        link_extensions = [".url", ".URL"]

        for ext in link_extensions:
            link_path = clean_base_path + ext
            if os.path.exists(link_path):
                try:
                    with open(link_path, "r", encoding="utf-8") as f:
                        content = f.read()

                    for line in content.splitlines():
                        line = line.strip()
                        if line.startswith("URL="):
                            url = line[4:].strip()
                            return web.json_response({"url": url})

                    return web.Response(status=404, text="URL not found in shortcut")
                except Exception as e:
                    return web.Response(status=500, text=f"Error reading shortcut: {str(e)}")

        return web.Response(status=404, text="No shortcut found")


@PromptServer.instance.routes.view("/custom_ext/get_block_weight_presets")
class GetBlockWeightPresetsEndpoint(web.View):
    async def get(self):
        names, _ = load_block_weight_presets()
        return web.json_response({"presets": names})


NODE_CLASS_MAPPINGS = {
    "ExtendedLoraLoaderSingle": ExtendedLoraLoaderSingle,
    "ExtendedLoraLoaderMulti": ExtendedLoraLoaderMulti,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ExtendedLoraLoaderSingle": "Load LoRA Model (Compact Side-Preview)",
    "ExtendedLoraLoaderMulti": "Load LoRA Model (Multi)",
}

WEB_DIRECTORY = "./web"