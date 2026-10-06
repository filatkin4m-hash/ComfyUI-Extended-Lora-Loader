import { app } from "../../../scripts/app.js";

// ============================================================
// ExtendedLoraLoaderSingle
// ============================================================
app.registerExtension({
    name: "Custom.ExtendedLoraLoaderPreview",

    async nodeCreated(node) {
        if (node.comfyClass === "ExtendedLoraLoaderSingle") {
            if (!node.properties) node.properties = {};

            if (node.properties.custom_width === undefined) {
                node.properties.custom_width = 420;
            }

            if (node.properties.custom_height === undefined) {
                node.properties.custom_height = 260;
            }

            if (node.properties.saved_description === undefined) {
                node.properties.saved_description = "";
            }

            if (node.properties.saved_triggers === undefined) {
                node.properties.saved_triggers = "";
            }

            node.size = [node.properties.custom_width, node.properties.custom_height];

            const TOP_OFFSET = 140;
            const MIN_DOM_HEIGHT = 130;
            const MIN_NODE_HEIGHT = TOP_OFFSET + MIN_DOM_HEIGHT;

            const mainContainer = document.createElement("div");
            mainContainer.style.display = "flex";
            mainContainer.style.flexDirection = "row";
            mainContainer.style.gap = "10px";
            mainContainer.style.width = "100%";
            mainContainer.style.height = "100%";
            mainContainer.style.boxSizing = "border-box";
            mainContainer.style.padding = "5px 0";

            const textColumn = document.createElement("div");
            textColumn.style.display = "flex";
            textColumn.style.flexDirection = "column";
            textColumn.style.gap = "6px";
            textColumn.style.flex = "1";
            textColumn.style.boxSizing = "border-box";

            const descArea = document.createElement("textarea");
            descArea.placeholder = "Description...";
            descArea.style.resize = "none";
            descArea.style.backgroundColor = "#1c1c1c";
            descArea.style.color = "#fff";
            descArea.style.border = "1px solid #444";
            descArea.style.borderRadius = "4px";
            descArea.style.padding = "4px";
            descArea.style.fontFamily = "sans-serif";
            descArea.style.fontSize = "8px";
            descArea.style.lineHeight = "1.2";
            descArea.style.width = "100%";
            textColumn.appendChild(descArea);

            const trigArea = document.createElement("textarea");
            trigArea.placeholder = "Trigger words...";
            trigArea.style.height = "45px";
            trigArea.style.flexShrink = "0";
            trigArea.style.resize = "none";
            trigArea.style.backgroundColor = "#1c1c1c";
            trigArea.style.color = "#fff";
            trigArea.style.border = "1px solid #444";
            trigArea.style.borderRadius = "4px";
            trigArea.style.padding = "4px";
            trigArea.style.fontFamily = "sans-serif";
            trigArea.style.fontSize = "8px";
            trigArea.style.lineHeight = "1.2";
            trigArea.style.width = "100%";
            textColumn.appendChild(trigArea);

            mainContainer.appendChild(textColumn);

            const imgContainer = document.createElement("div");
            imgContainer.style.width = "130px";
            imgContainer.style.display = "flex";
            imgContainer.style.alignItems = "flex-start";
            imgContainer.style.flexShrink = "0";

            const imgHtml = document.createElement("img");
            imgHtml.style.width = "100%";
            imgHtml.style.height = "auto";
            imgHtml.style.maxHeight = "150px";
            imgHtml.style.objectFit = "contain";
            imgHtml.style.borderRadius = "6px";
            imgHtml.style.border = "1px solid #333";
            imgHtml.style.backgroundColor = "#151515";
            imgHtml.style.display = "none";
            imgHtml.style.cursor = "pointer";
            imgHtml.title = "Click to open link";
            imgContainer.appendChild(imgHtml);

            mainContainer.appendChild(imgContainer);

            imgHtml.addEventListener("click", async (e) => {
                e.stopPropagation();

                const loraWidget = node.widgets?.find((w) => w.name === "lora_name");
                if (!loraWidget || !loraWidget.value) return;

                try {
                    const response = await fetch(
                        `/custom_ext/get_lora_link?name=${encodeURIComponent(loraWidget.value)}`
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.url) {
                            window.open(data.url, "_blank");
                        }
                    }
                } catch (error) {
                    console.error("Failed to open link:", error);
                }
            });

            mainContainer.addEventListener(
                "wheel",
                (e) => {
                    const target = e.target;
                    let shouldZoom = true;

                    if (target.tagName === "TEXTAREA") {
                        const atTop = target.scrollTop === 0;
                        const atBottom =
                            target.scrollTop + target.clientHeight >=
                            target.scrollHeight - 1;

                        if (e.deltaY < 0 && !atTop) {
                            shouldZoom = false;
                        } else if (e.deltaY > 0 && !atBottom) {
                            shouldZoom = false;
                        }
                    }

                    if (shouldZoom) {
                        app.canvas.canvas.dispatchEvent(
                            new WheelEvent("wheel", {
                                deltaX: e.deltaX,
                                deltaY: e.deltaY,
                                deltaZ: e.deltaZ,
                                ctrlKey: e.ctrlKey,
                                altKey: e.altKey,
                                shiftKey: e.shiftKey,
                                metaKey: e.metaKey,
                                clientX: e.clientX,
                                clientY: e.clientY,
                                screenX: e.screenX,
                                screenY: e.screenY,
                                bubbles: true,
                            })
                        );
                        e.preventDefault();
                    }
                },
                { passive: false }
            );

            let isPanning = false;
            let lastMouseX = 0;
            let lastMouseY = 0;

            mainContainer.addEventListener("mousedown", (e) => {
                if (e.button === 1) {
                    isPanning = true;
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                    e.preventDefault();
                }
            });

            window.addEventListener("mousemove", (e) => {
                if (isPanning) {
                    const deltaX = e.clientX - lastMouseX;
                    const deltaY = e.clientY - lastMouseY;

                    app.canvas.ds.offset[0] += deltaX / app.canvas.ds.scale;
                    app.canvas.ds.offset[1] += deltaY / app.canvas.ds.scale;

                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;

                    app.canvas.setDirty(true, true);
                    e.preventDefault();
                }
            });

            window.addEventListener("mouseup", (e) => {
                if (isPanning && e.button === 1) {
                    isPanning = false;
                    e.preventDefault();
                }
            });

            const comboWidget = node.addDOMWidget(
                "compact_layout",
                "CUSTOM_LAYOUT",
                mainContainer,
                {
                    serialize: false,
                }
            );

            let lastCalculatedHeight = 0;

            const adjustWidgetSize = () => {
                if (!comboWidget.element) return;

                const topOffset = comboWidget.y || TOP_OFFSET;
                const availableHeight = node.size[1] - topOffset - 16;
                const finalHeight = Math.max(MIN_DOM_HEIGHT, availableHeight);

                if (finalHeight === lastCalculatedHeight) return;

                lastCalculatedHeight = finalHeight;

                comboWidget.element.style.height = `${finalHeight}px`;
                textColumn.style.height = `${finalHeight - 10}px`;

                const descHeight = finalHeight - 10 - 45 - 6;
                descArea.style.height = `${Math.max(50, descHeight)}px`;
                descArea.style.flex = "none";
            };

            const originalComputeSize = node.computeSize;
            node.computeSize = function () {
                const res = originalComputeSize
                    ? originalComputeSize.apply(this, arguments)
                    : [0, 0];

                if (res[1] < MIN_NODE_HEIGHT) {
                    res[1] = MIN_NODE_HEIGHT;
                }

                return res;
            };

            let isResizing = false;
            const originalOnResize = node.onResize;

            node.onResize = function (size) {
                if (isResizing) return;

                if (originalOnResize) originalOnResize.apply(this, arguments);

                if (size && size[0] && size[1]) {
                    if (size[1] < MIN_NODE_HEIGHT) {
                        isResizing = true;
                        size[1] = MIN_NODE_HEIGHT;
                        this.setSize(size);
                        isResizing = false;
                    }

                    node.properties.custom_width = size[0];
                    node.properties.custom_height = size[1];

                    lastCalculatedHeight = 0;
                    adjustWidgetSize();
                }
            };

            const originalOnDrawForeground = node.onDrawForeground;
            node.onDrawForeground = function (ctx) {
                if (originalOnDrawForeground) {
                    originalOnDrawForeground.apply(this, arguments);
                }

                adjustWidgetSize();
            };

            descArea.value = node.properties.saved_description;
            trigArea.value = node.properties.saved_triggers;

            const updateBackendWidgets = () => {
                const descWidget = node.widgets?.find((w) => w.name === "description");
                const trigWidget = node.widgets?.find((w) => w.name === "triggers");

                if (descWidget) descWidget.value = node.properties.saved_description;
                if (trigWidget) trigWidget.value = node.properties.saved_triggers;
            };

            const hideStandardWidgets = () => {
                ["description", "triggers"].forEach((name) => {
                    const w = node.widgets?.find((w) => w.name === name);
                    if (w) {
                        w.hidden = true;
                        w.computeSize = () => [0, 0];

                        if (w.element) {
                            w.element.style.display = "none";
                        }
                    }
                });
            };

            descArea.addEventListener("input", (e) => {
                node.properties.saved_description = e.target.value;
                updateBackendWidgets();
                node.setDirtyCanvas(true);
            });

            trigArea.addEventListener("input", (e) => {
                node.properties.saved_triggers = e.target.value;
                updateBackendWidgets();
                node.setDirtyCanvas(true);
            });

            node.onConfigure = function () {
                descArea.value = node.properties.saved_description || "";
                trigArea.value = node.properties.saved_triggers || "";
                updateBackendWidgets();

                setTimeout(() => {
                    const loraWidget = node.widgets?.find((w) => w.name === "lora_name");
                    if (loraWidget && loraWidget.value) {
                        updateCoverImage(loraWidget.value);
                    }

                    lastCalculatedHeight = 0;
                    adjustWidgetSize();
                }, 100);
            };

            const updateCoverImage = (loraName) => {
                if (!loraName) return;

                const imgUrl = `/custom_ext/get_lora_cover?name=${encodeURIComponent(
                    loraName
                )}&t=${Date.now()}`;

                imgHtml.src = imgUrl;

                imgHtml.onload = () => {
                    imgHtml.style.display = "block";
                    imgContainer.style.display = "flex";

                    lastCalculatedHeight = 0;
                    adjustWidgetSize();
                    node.setDirtyCanvas(true, true);
                };

                imgHtml.onerror = () => {
                    imgHtml.style.display = "none";
                    imgContainer.style.display = "none";

                    lastCalculatedHeight = 0;
                    adjustWidgetSize();
                    node.setDirtyCanvas(true, true);
                };
            };

            setTimeout(() => {
                hideStandardWidgets();

                const loraWidget = node.widgets?.find((w) => w.name === "lora_name");

                if (loraWidget) {
                    let originalCallback = loraWidget.callback;

                    loraWidget.callback = function (value) {
                        if (originalCallback) originalCallback.apply(this, arguments);
                        updateCoverImage(value);
                    };

                    if (loraWidget.value) {
                        updateCoverImage(loraWidget.value);
                    }
                }

                updateBackendWidgets();

                lastCalculatedHeight = 0;
                adjustWidgetSize();
            }, 200);
        }
    },
});

// ============================================================
// ExtendedLoraLoaderMulti
// ============================================================
app.registerExtension({
    name: "Custom.ExtendedLoraLoaderMulti",

    async nodeCreated(node) {
        if (node.comfyClass !== "ExtendedLoraLoaderMulti") return;
        if (node.__multiLoraInitialized) return;

        node.__multiLoraInitialized = true;

        const createEmptyEntry = () => ({
            enabled: true,
            lora_name: "",
            strength_model: 1.0,
            block_weight_preset: "None",
            description: "",
            triggers: "",
        });

        const normalizeEntry = (entry) => {
            const strength = parseFloat(entry?.strength_model);

            const result = {
                enabled: entry?.enabled !== false,
                lora_name: typeof entry?.lora_name === "string" ? entry.lora_name : "",
                strength_model: Number.isFinite(strength) ? strength : 1.0,
                block_weight_preset:
                    typeof entry?.block_weight_preset === "string" &&
                    entry.block_weight_preset.trim() !== ""
                        ? entry.block_weight_preset
                        : "None",
                description: typeof entry?.description === "string" ? entry.description : "",
                triggers: typeof entry?.triggers === "string" ? entry.triggers : "",
            };

            if (typeof entry?.desc_height === "number" && entry.desc_height > 0) {
                result.desc_height = entry.desc_height;
            }

            if (typeof entry?.trig_height === "number" && entry.trig_height > 0) {
                result.trig_height = entry.trig_height;
            }

            return result;
        };

        if (!node.properties) node.properties = {};

        if (node.properties.custom_width === undefined) {
            node.properties.custom_width = 680;
        }

        if (node.properties.custom_height === undefined) {
            node.properties.custom_height = 480;
        }

        if (node.properties.multi_description === undefined) {
            node.properties.multi_description = "";
        }

        if (!Array.isArray(node.properties.multi_loras) || node.properties.multi_loras.length === 0) {
            node.properties.multi_loras = [createEmptyEntry()];
        } else {
            node.properties.multi_loras = node.properties.multi_loras.map(normalizeEntry);
        }

        node.size = [node.properties.custom_width, node.properties.custom_height];

        const MIN_NODE_HEIGHT = 320;

        let loraOptions = [""];
        let blockPresetOptions = ["None"];

        let autoSizeLock = false;
        let comboWidget = null;
        let syncedOnce = false;
        let lastWidgetVisible = null;

        let listWidget = node.widgets?.find((w) => w.name === "lora_list");

        if (!listWidget) {
            listWidget = node.addWidget("text", "lora_list", "[]", null, {});
        }

        listWidget.hidden = true;
        listWidget.serialize = true;

        if (listWidget.computeSize) {
            listWidget.computeSize = () => [0, 0];
        }

        const templateWidget =
            node.widgets?.find((w) => w.name === "lora_template") || null;

        if (templateWidget?.options?.values?.length) {
            loraOptions = [...templateWidget.options.values];

            if (!loraOptions.includes("")) {
                loraOptions.unshift("");
            }
        }

        function styleControl(el) {
            el.style.backgroundColor = "#1c1c1c";
            el.style.color = "#fff";
            el.style.border = "1px solid #444";
            el.style.borderRadius = "4px";
            el.style.padding = "3px 4px";
            el.style.fontFamily = "sans-serif";
            el.style.fontSize = "10px";
            el.style.lineHeight = "1.3";
            el.style.boxSizing = "border-box";
        }

        function styleButton(el) {
            el.style.backgroundColor = "#2b2b2b";
            el.style.color = "#ddd";
            el.style.border = "1px solid #555";
            el.style.borderRadius = "4px";
            el.style.cursor = "pointer";
            el.style.padding = "3px 8px";
            el.style.fontSize = "10px";
            el.style.boxSizing = "border-box";
        }

        function styleSmallBtn(el) {
            el.style.backgroundColor = "#2b2b2b";
            el.style.color = "#ddd";
            el.style.border = "1px solid #555";
            el.style.borderRadius = "4px";
            el.style.cursor = "pointer";
            el.style.padding = "3px 0";
            el.style.fontSize = "10px";
            el.style.width = "24px";
            el.style.flexShrink = "0";
            el.style.boxSizing = "border-box";
            el.style.textAlign = "center";
        }

        function fitTextarea(el, minHeight, maxHeight) {
            if (!el) return;

            el.style.height = "auto";

            let h = el.scrollHeight || minHeight;

            if (h < minHeight) h = minHeight;
            if (h > maxHeight) h = maxHeight;

            el.style.height = `${h}px`;
            el.style.overflowY = "auto";
        }

        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.gap = "8px";
        root.style.width = "100%";
        root.style.boxSizing = "border-box";
        root.style.padding = "6px 0";
        root.style.fontFamily = "sans-serif";
        root.style.fontSize = "10px";
        root.style.color = "#ddd";
        root.style.overflowX = "hidden";
        root.style.overflowY = "auto";

        const descArea = document.createElement("textarea");
        descArea.placeholder = "Common description...";
        descArea.value = node.properties.multi_description || "";
        styleControl(descArea);
        descArea.style.resize = "vertical";
        descArea.style.width = "100%";
        descArea.style.minHeight = "30px";
        descArea.style.overflowY = "auto";
        descArea.style.height = "52px";

        const toolbar = document.createElement("div");
        toolbar.style.display = "flex";
        toolbar.style.gap = "6px";
        toolbar.style.alignItems = "center";
        toolbar.style.flexWrap = "wrap";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+ Add LoRA";
        styleButton(addBtn);

        const refreshBtn = document.createElement("button");
        refreshBtn.type = "button";
        refreshBtn.textContent = "Refresh LoRA list";
        styleButton(refreshBtn);

        const refreshPresetsBtn = document.createElement("button");
        refreshPresetsBtn.type = "button";
        refreshPresetsBtn.textContent = "Refresh block presets";
        styleButton(refreshPresetsBtn);

        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "6px";

        root.appendChild(descArea);

        toolbar.appendChild(addBtn);
        toolbar.appendChild(refreshBtn);
        toolbar.appendChild(refreshPresetsBtn);

        root.appendChild(toolbar);
        root.appendChild(list);

        comboWidget = node.addDOMWidget(
            "multi_layout",
            "CUSTOM_MULTI_LAYOUT",
            root,
            {
                serialize: false,
            }
        );

        function applySavedDescHeight() {
            const h = node.properties.multi_desc_height;

            if (typeof h === "number" && h > 30) {
                descArea.style.height = `${h}px`;
            }
        }

        function writeHiddenState() {
            if (listWidget) {
                listWidget.value = JSON.stringify(node.properties.multi_loras || []);
            }
        }

        function syncHidden() {
            writeHiddenState();
            node.setDirtyCanvas(true);
        }

        function requestSync() {
            requestAnimationFrame(() => syncHeight());
        }

        function isWidgetVisible() {
            const el = comboWidget?.element;

            if (!el) return false;
            if (!el.offsetParent) return false;
            if (el.offsetHeight === 0) return false;

            return true;
        }

        const textareaMetaMap = new WeakMap();

        const textareaResizeObserver = new ResizeObserver((obsEntries) => {
            if (!isWidgetVisible()) return;

            for (const obsEntry of obsEntries) {
                const el = obsEntry.target;
                const h = el.offsetHeight;

                if (h < 20) continue;

                if (el === descArea) {
                    node.properties.multi_desc_height = h;
                } else {
                    const meta = textareaMetaMap.get(el);

                    if (meta) {
                        meta.entry[meta.key] = h;
                    }
                }
            }

            requestSync();
        });

        textareaResizeObserver.observe(descArea);

        function syncHeight() {
            if (!comboWidget?.element) return;
            if (!isWidgetVisible()) return;

            root.style.height = "auto";

            const contentHeight = Math.max(
                140,
                root.scrollHeight || 0,
                root.offsetHeight || 0
            );

            const topOffset = comboWidget.y || 90;
            const needed = Math.max(
                MIN_NODE_HEIGHT,
                topOffset + contentHeight + 26
            );

            comboWidget.element.style.height = `${contentHeight}px`;
            root.style.height = `${contentHeight}px`;

            if (!autoSizeLock && Math.abs(node.size[1] - needed) > 2) {
                autoSizeLock = true;
                node.setSize([Math.max(520, node.size[0]), needed]);
                autoSizeLock = false;
            }

            node.properties.custom_width = node.size[0];
            node.properties.custom_height = node.size[1];

            node.setDirtyCanvas(true);
        }

        function fillSelect(select, selected) {
            select.innerHTML = "";

            const selectedValue = selected || "";
            const options = [...loraOptions];

            if (selectedValue && !options.includes(selectedValue)) {
                options.push(selectedValue);
            }

            for (const value of options) {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = value === "" ? "(no LoRA)" : value;
                select.appendChild(opt);
            }

            select.value = selectedValue;

            if (select.value !== selectedValue) {
                for (const opt of select.options) {
                    if (opt.value === selectedValue) {
                        select.value = selectedValue;
                        break;
                    }
                }
            }
        }

        function fillPresetSelect(select, selected) {
            select.innerHTML = "";

            const selectedValue =
                selected && String(selected).trim() !== ""
                    ? String(selected)
                    : "None";

            const options = [...blockPresetOptions];

            if (!options.includes("None")) {
                options.unshift("None");
            }

            if (selectedValue !== "None" && !options.includes(selectedValue)) {
                options.push(selectedValue);
            }

            for (const value of options) {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = value;
                select.appendChild(opt);
            }

            select.value = selectedValue;

            if (select.value !== selectedValue) {
                for (const opt of select.options) {
                    if (opt.value === selectedValue) {
                        select.value = selectedValue;
                        break;
                    }
                }
            }
        }

        function updateCover(img, name) {
            const container = img.parentElement;

            if (!name) {
                if (container) {
                    container.style.display = "none";
                }

                img.removeAttribute("src");
                return;
            }

            const token = Date.now().toString();
            img.dataset.coverToken = token;

            img.onload = () => {
                if (img.dataset.coverToken !== token) return;

                if (container) {
                    container.style.display = "flex";
                }

                img.style.display = "block";
                requestSync();
            };

            img.onerror = () => {
                if (img.dataset.coverToken !== token) return;

                if (container) {
                    container.style.display = "none";
                }

                img.style.display = "none";
                requestSync();
            };

            img.src = `/custom_ext/get_lora_cover?name=${encodeURIComponent(name)}&t=${token}`;
        }

        function hideServiceWidgets() {
            ["lora_list", "lora_template"].forEach((name) => {
                const w = node.widgets?.find((w) => w.name === name);

                if (w) {
                    w.hidden = true;

                    if (w.computeSize) {
                        w.computeSize = () => [0, 0];
                    }

                    if (w.element) {
                        w.element.style.display = "none";
                    }
                }
            });
        }

        async function fetchLoraOptions() {
            try {
                const response = await fetch("/object_info/ExtendedLoraLoaderMulti");
                if (!response.ok) return;

                const data = await response.json();
                const values =
                    data?.ExtendedLoraLoaderMulti?.input?.required?.lora_template?.[0];

                if (Array.isArray(values) && values.length) {
                    loraOptions = values.includes("") ? [...values] : ["", ...values];

                    if (templateWidget) {
                        templateWidget.options = templateWidget.options || {};
                        templateWidget.options.values = loraOptions;
                    }

                    renderList();
                    syncHidden();
                    requestSync();
                }
            } catch (error) {
                console.error("Failed to refresh LoRA list:", error);
            }
        }

        async function fetchBlockPresetOptions(renderAfter = true) {
            try {
                const response = await fetch("/custom_ext/get_block_weight_presets");
                if (!response.ok) return;

                const data = await response.json();
                const values = Array.isArray(data?.presets)
                    ? data.presets.map((x) => String(x))
                    : [];

                if (!values.includes("None")) {
                    values.unshift("None");
                }

                blockPresetOptions = values;

                if (renderAfter) {
                    renderList();
                    syncHidden();
                    requestSync();
                }
            } catch (error) {
                console.error("Failed to refresh block presets:", error);
            }
        }

        function moveEntry(fromIndex, toIndex) {
            const arr = node.properties.multi_loras;

            if (toIndex < 0 || toIndex >= arr.length) return;

            const item = arr.splice(fromIndex, 1)[0];
            arr.splice(toIndex, 0, item);

            renderList();
            syncHidden();
        }

        function applyRowState(row, entry) {
            if (entry.enabled) {
                row.style.opacity = "1";
                row.style.filter = "none";
                row.style.backgroundColor = "#1a1a1a";
                row.style.border = "1px solid #363636";
            } else {
                row.style.opacity = "0.38";
                row.style.filter = "grayscale(0.85)";
                row.style.backgroundColor = "#0d0d0d";
                row.style.border = "1px solid #222";
            }
        }

        function createRow(entry, index) {
            entry.enabled = entry.enabled !== false;

            entry.lora_name = entry.lora_name || "";

            entry.strength_model = Number.isFinite(parseFloat(entry.strength_model))
                ? parseFloat(entry.strength_model)
                : 1.0;

            entry.block_weight_preset =
                typeof entry.block_weight_preset === "string" &&
                entry.block_weight_preset.trim() !== ""
                    ? entry.block_weight_preset
                    : "None";

            entry.description = typeof entry.description === "string"
                ? entry.description
                : "";

            entry.triggers = typeof entry.triggers === "string"
                ? entry.triggers
                : "";

            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.flexDirection = "column";
            row.style.gap = "6px";
            row.style.padding = "6px";
            row.style.borderRadius = "6px";
            row.style.boxSizing = "border-box";

            applyRowState(row, entry);

            const topLine = document.createElement("div");
            topLine.style.display = "flex";
            topLine.style.gap = "4px";
            topLine.style.alignItems = "center";
            topLine.style.flexWrap = "wrap";
            topLine.style.width = "100%";

            const enable = document.createElement("input");
            enable.type = "checkbox";
            enable.checked = entry.enabled;
            enable.title = "Enable/Disable";
            enable.style.cursor = "pointer";
            enable.style.flexShrink = "0";

            const select = document.createElement("select");
            styleControl(select);
            select.style.flex = "1";
            select.style.minWidth = "140px";
            select.title = "LoRA name";
            fillSelect(select, entry.lora_name);

            const strength = document.createElement("input");
            strength.type = "number";
            strength.step = "0.01";
            strength.value = entry.strength_model;
            strength.title = "Strength";
            styleControl(strength);
            strength.style.width = "68px";
            strength.style.flexShrink = "0";

            const presetSelect = document.createElement("select");
            styleControl(presetSelect);
            presetSelect.title = "Block weight preset";
            presetSelect.style.width = "170px";
            presetSelect.style.minWidth = "120px";
            presetSelect.style.flexShrink = "1";
            fillPresetSelect(presetSelect, entry.block_weight_preset);

            const moveUpBtn = document.createElement("button");
            moveUpBtn.type = "button";
            moveUpBtn.textContent = "↑";
            moveUpBtn.title = "Move up";
            styleSmallBtn(moveUpBtn);

            if (index === 0) {
                moveUpBtn.style.opacity = "0.3";
                moveUpBtn.style.cursor = "default";
            }

            const moveDownBtn = document.createElement("button");
            moveDownBtn.type = "button";
            moveDownBtn.textContent = "↓";
            moveDownBtn.title = "Move down";
            styleSmallBtn(moveDownBtn);

            if (index >= node.properties.multi_loras.length - 1) {
                moveDownBtn.style.opacity = "0.3";
                moveDownBtn.style.cursor = "default";
            }

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.textContent = "✕";
            removeBtn.title = "Remove";
            styleSmallBtn(removeBtn);
            removeBtn.style.width = "26px";

            topLine.appendChild(enable);
            topLine.appendChild(select);
            topLine.appendChild(strength);
            topLine.appendChild(presetSelect);
            topLine.appendChild(moveUpBtn);
            topLine.appendChild(moveDownBtn);
            topLine.appendChild(removeBtn);

            const contentLine = document.createElement("div");
            contentLine.style.display = "flex";
            contentLine.style.flexDirection = "row";
            contentLine.style.gap = "8px";
            contentLine.style.alignItems = "flex-start";
            contentLine.style.width = "100%";

            const textColumn = document.createElement("div");
            textColumn.style.flex = "1";
            textColumn.style.display = "flex";
            textColumn.style.flexDirection = "column";
            textColumn.style.gap = "4px";
            textColumn.style.minWidth = "0";

            const rowDescArea = document.createElement("textarea");
            rowDescArea.placeholder = "LoRA description...";
            rowDescArea.value = entry.description;
            styleControl(rowDescArea);
            rowDescArea.style.resize = "vertical";
            rowDescArea.style.width = "100%";
            rowDescArea.style.minHeight = "30px";
            rowDescArea.style.overflowY = "auto";

            if (entry.desc_height && entry.desc_height > 30) {
                rowDescArea.style.height = `${entry.desc_height}px`;
            } else {
                rowDescArea.style.height = "58px";
            }

            const rowTrigArea = document.createElement("textarea");
            rowTrigArea.placeholder = "Trigger words...\nOne line or multiple lines.";
            rowTrigArea.value = entry.triggers;
            styleControl(rowTrigArea);
            rowTrigArea.style.resize = "vertical";
            rowTrigArea.style.width = "100%";
            rowTrigArea.style.minHeight = "30px";
            rowTrigArea.style.overflowY = "auto";

            if (entry.trig_height && entry.trig_height > 30) {
                rowTrigArea.style.height = `${entry.trig_height}px`;
            } else {
                rowTrigArea.style.height = "42px";
            }

            textColumn.appendChild(rowDescArea);
            textColumn.appendChild(rowTrigArea);

            const imgContainer = document.createElement("div");
            imgContainer.style.width = "130px";
            imgContainer.style.display = "none";
            imgContainer.style.alignItems = "flex-start";
            imgContainer.style.flexShrink = "0";

            const cover = document.createElement("img");
            cover.style.width = "100%";
            cover.style.height = "auto";
            cover.style.maxHeight = "150px";
            cover.style.objectFit = "contain";
            cover.style.borderRadius = "6px";
            cover.style.border = "1px solid #333";
            cover.style.backgroundColor = "#151515";
            cover.style.cursor = "pointer";
            cover.style.display = "block";
            cover.title = "Click to open source link";

            imgContainer.appendChild(cover);

            contentLine.appendChild(textColumn);
            contentLine.appendChild(imgContainer);

            row.appendChild(topLine);
            row.appendChild(contentLine);

            updateCover(cover, entry.lora_name);

            textareaMetaMap.set(rowDescArea, { entry, key: "desc_height" });
            textareaMetaMap.set(rowTrigArea, { entry, key: "trig_height" });

            textareaResizeObserver.observe(rowDescArea);
            textareaResizeObserver.observe(rowTrigArea);

            cover.addEventListener("click", async (e) => {
                e.stopPropagation();

                const name = select.value;
                if (!name) return;

                try {
                    const response = await fetch(
                        `/custom_ext/get_lora_link?name=${encodeURIComponent(name)}`
                    );

                    if (response.ok) {
                        const data = await response.json();

                        if (data.url) {
                            window.open(data.url, "_blank");
                        }
                    }
                } catch (error) {
                    console.error("Failed to open LoRA link:", error);
                }
            });

            enable.addEventListener("change", () => {
                entry.enabled = enable.checked;
                renderList();
                syncHidden();
            });

            select.addEventListener("change", () => {
                entry.lora_name = select.value;
                updateCover(cover, entry.lora_name);
                syncHidden();
            });

            strength.addEventListener("input", () => {
                const val = parseFloat(strength.value);

                if (Number.isFinite(val)) {
                    entry.strength_model = val;
                }

                syncHidden();
            });

            presetSelect.addEventListener("change", () => {
                entry.block_weight_preset = presetSelect.value || "None";
                syncHidden();
            });

            moveUpBtn.addEventListener("click", () => {
                if (index > 0) {
                    moveEntry(index, index - 1);
                }
            });

            moveDownBtn.addEventListener("click", () => {
                if (index < node.properties.multi_loras.length - 1) {
                    moveEntry(index, index + 1);
                }
            });

            rowDescArea.addEventListener("input", () => {
                entry.description = rowDescArea.value;
                syncHidden();
                requestSync();
            });

            rowTrigArea.addEventListener("input", () => {
                entry.triggers = rowTrigArea.value;
                syncHidden();
                requestSync();
            });

            removeBtn.addEventListener("click", () => {
                node.properties.multi_loras.splice(index, 1);
                renderList();
                syncHidden();
            });

            setTimeout(() => {
                if (!entry.desc_height) {
                    fitTextarea(rowDescArea, 58, 160);
                }

                if (!entry.trig_height) {
                    fitTextarea(rowTrigArea, 42, 160);
                }
            }, 0);

            return row;
        }

        function renderList() {
            list.innerHTML = "";

            node.properties.multi_loras.forEach((entry, index) => {
                list.appendChild(createRow(entry, index));
            });

            requestSync();
        }

        descArea.addEventListener("input", () => {
            node.properties.multi_description = descArea.value;
            node.setDirtyCanvas(true);
        });

        addBtn.addEventListener("click", () => {
            const arr = node.properties.multi_loras;
            const newEntry = createEmptyEntry();

            if (arr.length > 0) {
                const lastEntry = arr[arr.length - 1];

                if (lastEntry.lora_name) {
                    newEntry.lora_name = lastEntry.lora_name;
                }
            }

            arr.push(newEntry);

            renderList();
            syncHidden();
        });

        refreshBtn.addEventListener("click", async () => {
            refreshBtn.disabled = true;
            await fetchLoraOptions();
            refreshBtn.disabled = false;
        });

        refreshPresetsBtn.addEventListener("click", async () => {
            refreshPresetsBtn.disabled = true;
            await fetchBlockPresetOptions(true);
            refreshPresetsBtn.disabled = false;
        });

        root.addEventListener(
            "wheel",
            (e) => {
                const target = e.target;
                let shouldZoom = true;

                if (target.tagName === "TEXTAREA") {
                    const atTop = target.scrollTop === 0;
                    const atBottom =
                        target.scrollTop + target.clientHeight >=
                        target.scrollHeight - 1;

                    if (e.deltaY < 0 && !atTop) {
                        shouldZoom = false;
                    } else if (e.deltaY > 0 && !atBottom) {
                        shouldZoom = false;
                    }
                }

                if (shouldZoom) {
                    app.canvas.canvas.dispatchEvent(
                        new WheelEvent("wheel", {
                            deltaX: e.deltaX,
                            deltaY: e.deltaY,
                            deltaZ: e.deltaZ,
                            deltaMode: e.deltaMode,
                            ctrlKey: e.ctrlKey,
                            altKey: e.altKey,
                            shiftKey: e.shiftKey,
                            metaKey: e.metaKey,
                            clientX: e.clientX,
                            clientY: e.clientY,
                            screenX: e.screenX,
                            screenY: e.screenY,
                            bubbles: true,
                            cancelable: true,
                        })
                    );

                    e.preventDefault();
                }
            },
            { passive: false }
        );

        let isPanning = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        root.addEventListener("mousedown", (e) => {
            if (e.button === 1) {
                isPanning = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                e.preventDefault();
            }
        });

        const onMouseMove = (e) => {
            if (!isPanning) return;

            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;

            app.canvas.ds.offset[0] += deltaX / app.canvas.ds.scale;
            app.canvas.ds.offset[1] += deltaY / app.canvas.ds.scale;

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            app.canvas.setDirty(true, true);
            e.preventDefault();
        };

        const onMouseUp = (e) => {
            if (isPanning && e.button === 1) {
                isPanning = false;
                e.preventDefault();
            }
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        const oldOnRemoved = node.onRemoved;

        node.onRemoved = function () {
            if (oldOnRemoved) oldOnRemoved.apply(this, arguments);

            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);

            textareaResizeObserver.disconnect();
        };

        const originalComputeSize = node.computeSize;

        node.computeSize = function () {
            const res = originalComputeSize
                ? originalComputeSize.apply(this, arguments)
                : [0, 0];

            if (!Array.isArray(res)) {
                return [node.properties.custom_width, MIN_NODE_HEIGHT];
            }

            if (res[0] < 520) {
                res[0] = Math.max(res[0], 520);
            }

            if (res[1] < MIN_NODE_HEIGHT) {
                res[1] = MIN_NODE_HEIGHT;
            }

            return res;
        };

        const originalOnResize = node.onResize;

        node.onResize = function (size) {
            if (originalOnResize) originalOnResize.apply(this, arguments);

            if (autoSizeLock) return;

            if (size && size[0] && size[1]) {
                if (size[1] < MIN_NODE_HEIGHT) {
                    autoSizeLock = true;
                    size[1] = MIN_NODE_HEIGHT;
                    this.setSize(size);
                    autoSizeLock = false;
                }

                node.properties.custom_width = size[0];
                node.properties.custom_height = size[1];

                requestSync();
            }
        };

        const originalOnDrawForeground = node.onDrawForeground;

        node.onDrawForeground = function (ctx) {
            if (originalOnDrawForeground) {
                originalOnDrawForeground.apply(this, arguments);
            }

            const visible = isWidgetVisible();

            if (!syncedOnce) {
                syncedOnce = true;
                applySavedDescHeight();
                requestSync();
            } else if (visible && lastWidgetVisible === false) {
                applySavedDescHeight();
                requestSync();
            }

            lastWidgetVisible = visible;
        };

        const originalOnConfigure = node.onConfigure;

        node.onConfigure = function () {
            if (originalOnConfigure) {
                originalOnConfigure.apply(this, arguments);
            }

            setTimeout(() => {
                if (listWidget?.value) {
                    try {
                        const parsed = JSON.parse(listWidget.value);

                        if (Array.isArray(parsed) && parsed.length) {
                            node.properties.multi_loras = parsed.map(normalizeEntry);
                        }
                    } catch (e) {
                        // ignore broken JSON
                    }
                }

                if (
                    !Array.isArray(node.properties.multi_loras) ||
                    node.properties.multi_loras.length === 0
                ) {
                    node.properties.multi_loras = [createEmptyEntry()];
                }

                descArea.value = node.properties.multi_description || "";

                applySavedDescHeight();
                hideServiceWidgets();
                renderList();
                syncHidden();
                requestSync();
            }, 100);
        };

        const originalSerialize = node.serialize;

        node.serialize = function () {
            writeHiddenState();

            return originalSerialize
                ? originalSerialize.apply(this, arguments)
                : {};
        };

        setTimeout(async () => {
            hideServiceWidgets();

            if (templateWidget?.options?.values?.length) {
                loraOptions = [...templateWidget.options.values];

                if (!loraOptions.includes("")) {
                    loraOptions.unshift("");
                }
            } else {
                await fetchLoraOptions();
            }

            await fetchBlockPresetOptions(false);

            if (
                listWidget?.value &&
                typeof listWidget.value === "string" &&
                listWidget.value.trim() !== "" &&
                listWidget.value.trim() !== "[]"
            ) {
                try {
                    const parsed = JSON.parse(listWidget.value);

                    if (Array.isArray(parsed) && parsed.length) {
                        node.properties.multi_loras = parsed.map(normalizeEntry);
                    }
                } catch (e) {
                    // ignore broken JSON
                }
            }

            if (
                !Array.isArray(node.properties.multi_loras) ||
                node.properties.multi_loras.length === 0
            ) {
                node.properties.multi_loras = [createEmptyEntry()];
            }

            descArea.value = node.properties.multi_description || "";

            applySavedDescHeight();
            renderList();
            syncHidden();
            requestSync();
        }, 250);
    },
});