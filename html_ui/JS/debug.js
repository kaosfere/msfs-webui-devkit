﻿/*! *****************************************************************************
    Author: dga711  in 2020

    Credits: Code is inspired by mechanisms and code found in Asobo's MSFS2020
***************************************************************************** */

// ENABLED/DISABLE Debug here
const DEBUG_ENABLED = true;
// CONSOLE Invisible on start (show via hotkey ALT+T)
const START_INVIS = false;
// SHOW FPS counter
const SHOW_FPS = true;

// ! don't touch these !
bLiveReload = true;
bAutoReloadCSS = true;
bDebugListeners = true;

// Credits: some of this code and concepts is Asobo's and is modified by me
class ModDebugMgr {
    constructor() {
        this.m_defaultPosRight = 4;
        this.m_defaultPosTop = 4;
        this.m_defaultLog = null;
        this.m_defaultWarn = null;
        this.m_defaultError = null;
        this.m_displayStyle = "none";
        this.m_highlightedNode = null;
        this.m_inspectorTooltipNode = null;
        this.m_liveReloadTimer = null;
        this.m_canReload = false;
    }

    AddDebugButton(text, callback, autoStart = false) {
        if (this.m_debugPanel == null) {
            document.addEventListener("DebugPanelCreated", this.AddDebugButton.bind(this, text, callback, autoStart));
            this.CreateDebugPanel();
            return;
        }
        var button = document.createElement("div");
        button.innerText = text;
        button.classList.add("debugButton");
        button.addEventListener("click", callback);
        if (this.m_ConsoleCallback) {
            button.addEventListener("click", this.UpdateConsole.bind(this));
        }

        document.getElementById("debugContent").appendChild(button);
        if (autoStart) {
            requestAnimationFrame(callback);
            this.UpdateConsole();
        }
    }

    CreateDebugPanel() {
        if (this.m_debugPanel != null)
            return;
        if (!document.body) {
            Coherent.on("ON_VIEW_LOADED", this.CreateDebugPanel.bind(this));
            return;
        }
        this.AddCustomCss();
        window.onerror = function (message, source, lineno, colno, error) { g_modDebugMgr.error(message); };

        // create panel
        this.m_debugPanel = document.createElement("div");
        this.m_debugPanel.id = "DebugPanel";
        this.m_debugPanel.classList.add("debugPanel");
        // TODO this could be nicer
        this.m_debugPanel.innerHTML = "<div id='debugHeader'>Debug <span id='deltatime'></span> <div id='debugActions' style='float:right'><button id='rfrsh'>R</button>&nbsp;<button id='toggleDbg'>-</button></div></div><div id='debugContent'></div>";

        document.body.appendChild(this.m_debugPanel);
        this.setDefaultPos(this.m_defaultPosRight, this.m_defaultPosTop);
        // this.dragDropHandler = new DragDropHandler(document.getElementById("DebugPanel"));
        document.dispatchEvent(new Event("DebugPanelCreated"));

        // bind toggle button
        document.getElementById("toggleDbg").addEventListener("click", this.TogglePanel);
        document.getElementById("rfrsh").addEventListener("click", function () {
            if (this.m_canReload) {
                window.document.location.reload(true);
                clearTimeout(this.m_liveReloadTimer);
            }
        });

        // collapse panel initially
        this.TogglePanel();
        // Window DragHandler 
        this.dragHandler = new DragHandler(this.m_debugPanel, "debugHeader")
        // hotkeys
        this.BindHotKeys();
        // start invis handling
        if (START_INVIS) {
            this.m_displayStyle = this.m_debugPanel.style.display;
            this.m_debugPanel.style.display = "none";
        }

        if (SHOW_FPS) {
            this.DisplayFpsLoop();
        }

        // ELEMENT inspector
        this.ActivateInspector();

        // css livereload (wait 5secs cause of weird lifecycle)
        this.m_liveReloadTimer = setTimeout(this.LiveReloadCSS, 5000);

        window.onbeforeunload = function (event) {          
            clearTimeout(this.m_liveReloadTimer);
        };

        this.m_canReload = true;
    }

    DisplayFpsLoop() {
        // create update loop to show frames
        let updateLoop = () => {
            let fpsValue = fps.tick();
            document.getElementById("deltatime").innerHTML = fpsValue;
            requestAnimationFrame(updateLoop);
        }
        requestAnimationFrame(updateLoop);
    }

    LiveReloadCSS() {
        this.m_canReload = false;
        LiveReload.reloadCSS();
        this.m_liveReloadTimer = setTimeout(g_modDebugMgr.LiveReloadCSS, 3000);
        this.m_canReload = true;
    }

    BindHotKeys() {
        window.document.addEventListener("keydown", function (e) {
            if (e.altKey && e.which == 82) {
                // ALT + R
                // somehow it wants a dblclick to really refresh stuff....
                document.getElementById("rfrsh").click();
                e.preventDefault();
            } else if (e.altKey && e.which == 84) {
                // ALT + T
                if (g_modDebugMgr.m_debugPanel.style.display === "none") {
                    g_modDebugMgr.m_debugPanel.style.display = g_modDebugMgr.m_displayStyle;
                }
                g_modDebugMgr.TogglePanel();
                e.preventDefault();
            }
        });
    }

    TogglePanel() {
        let panel = document.getElementById("debugContent");
        panel.classList.toggle("collapsed");
        document.getElementById("DebugPanel").classList.toggle("collapsed");
        if (panel.classList.contains("collapsed"))
            document.getElementById("toggleDbg").innerHTML = "X";
        else
            document.getElementById("toggleDbg").innerHTML = "-";
    }

    UpdateConsole() {
        if (this.m_ConsoleCallback) {
            this.m_consoleElem.innerHTML = this.m_ConsoleCallback();
        }
    }
    AddConsole(callback, force = false) {
        if (this.m_debugPanel == null) {
            document.addEventListener("DebugPanelCreated", this.AddConsole.bind(this, callback));
            this.CreateDebugPanel();
            return;
        }
        this.m_consoleElem = document.createElement("div");
        this.m_consoleElem.classList.add("Console");
        this.m_consoleElem.classList.add("scrollbar");
        document.getElementById("debugContent").appendChild(this.m_consoleElem);
        this.m_ConsoleCallback = callback;
        if (!this.m_defaultLog)
            this.m_defaultLog = console.log;
        if (!this.m_defaultWarn)
            this.m_defaultWarn = console.warn;
        if (!this.m_defaultError)
            this.m_defaultError = console.error;
        console.log = this.log.bind(this);
        console.warn = this.warn.bind(this);
        console.error = this.error.bind(this);
    }
    log() {
        this.m_defaultLog.apply(console, arguments);
        this.logConsole("log", ...arguments);
    }
    warn() {
        this.m_defaultWarn.apply(console, arguments);
        this.logConsole("warn", ...arguments);
    }
    error() {
        this.m_defaultError.apply(console, arguments);
        this.logConsole("error", ...arguments);
    }
    logConsole(style, ...rest) {
        var isPanelCollapsed = document.getElementById("DebugPanel").classList.contains("collapsed");
        if (style === "error" && isPanelCollapsed) {
            this.TogglePanel();
        }

        var Args = Array.prototype.slice.call(arguments);
        for (var i = 1; i < Args.length; i++) {
            var node = document.createElement("div");
            node.innerText = (Args[i]);
            node.classList.add(style);
            this.m_consoleElem.appendChild(node);
            // "buffer"
            if (this.m_consoleElem.childElementCount > 150) {
                this.m_consoleElem.firstChild.remove()
            }
            if (!isPanelCollapsed) {
                this.m_consoleElem.scrollTop = -this.m_consoleElem.scrollHeight;
            }
        }
    }

    setDefaultPos(right, top) {
        this.m_defaultPosRight = right;
        this.m_defaultPosTop = top;
        if (this.m_debugPanel) {
            this.m_debugPanel.style.top = this.m_defaultPosTop + "%";
            this.m_debugPanel.style.right = this.m_defaultPosRight + "%";
        }
    }

    AddCustomCss() {
        // TODO: not sure if necessary
        var css = document.getElementById("debugcss");
        if (!css) {
            var head = document.getElementsByTagName('head')[0];
            var link = document.createElement('link');
            link.id = "debugcss";
            link.rel = 'stylesheet';
            link.type = 'text/css';
            let versionNum = Math.random() * 10000000;
            link.href = '/SCSS/debug.css?version=' + versionNum;
            link.media = 'all';
            head.appendChild(link);
        }
        else {
            let url = new URL(css.href);
            let version = url.searchParams.get("version");
            let versionNum = Math.random() * 10000000;
            url.searchParams.set("version", (versionNum).toString());
            css.href = url.href;
        }
    }

    ActivateInspector() {
        document.addEventListener("DOMNodeRemoved", function (ev) {
            if (ev.target == this.m_highlightedNode) {
                if (this.m_highlightedNode != null) {
                    this.m_highlightedNode.classList.remove("inspector-highlight");
                    this.m_highlightedNode = null;
                }
                if (this.m_inspectorTooltipNode != null) {
                    this.m_inspectorTooltipNode.remove();
                }
            }
        });

        document.addEventListener("click", function (ev) {
            let highlightClicked = ev.target.classList.contains("inspector-highlight");
            if (this.m_highlightedNode != null) {
                this.m_highlightedNode.classList.remove("inspector-highlight");
                this.m_highlightedNode = null;
            }
            if (this.m_inspectorTooltipNode != null) {
                this.m_inspectorTooltipNode.remove();
            }

            if (highlightClicked) return;
            if (document.getElementById("DebugPanel").contains(ev.target)) return;

            this.m_highlightedNode = ev.target;
            this.m_highlightedNode.classList.add("inspector-highlight");

            this.m_inspectorTooltipNode = document.createElement("div");
            this.m_inspectorTooltipNode.classList.add("inspector-tooltip");
            this.m_inspectorTooltipNode.innerHTML = `ID: <i>${this.m_highlightedNode.id}</i><br/>`;
            this.m_inspectorTooltipNode.innerHTML += `class: <i>${this.m_highlightedNode.className}</i><br/>`;

            // get style
            let elStyle = ev.target.style;
            let computedStyle = window.getComputedStyle(this.m_highlightedNode, null);

            let whiteList = ["width", "height", "color", "background-color", "position", "top", "left", "margin", "padding"];
            for (let i = whiteList.length; i--;) {
                let prop = whiteList[i];
                this.m_inspectorTooltipNode.innerHTML += "  " + prop + " = '<i>" + computedStyle[prop] + "</i>'<br />";
            }

            document.body.appendChild(this.m_inspectorTooltipNode);

            // set pos
            let bodyhalf = document.body.offsetHeight / 2;
            let rect = this.m_highlightedNode.getBoundingClientRect();
            let offset = this.m_highlightedNode.offsetHeight + 6;
            if (rect.top > bodyhalf) {
                offset = -(this.m_inspectorTooltipNode.offsetHeight) - 6;
            }
            this.m_inspectorTooltipNode.style.top = (rect.top + offset) + "px";
            this.m_inspectorTooltipNode.style.left = Math.max(0, rect.left) + "px";

            ev.preventDefault();
        });
    }

}
var g_modDebugMgr;
if (DEBUG_ENABLED) {
    g_modDebugMgr = new ModDebugMgr;
}

class DragHandler {
    constructor(element, masterChildId) {
        this.element = element;
        this.pos = [0, 0];
        let dragElem = document.getElementById(masterChildId);
        if (dragElem) {
            dragElem.onmousedown = this.onMouseDown.bind(this);
        }
    }

    onMouseDown(event) {
        event.preventDefault();
        this.pos[0] = event.clientX;
        this.pos[1] = event.clientY;
        this.element.parentElement.onmouseup = this.onMouseUp.bind(this);
    }

    onMouseUp(event) {
        event.preventDefault();
        this.pos[0] = this.pos[0] - event.clientX;
        this.pos[1] = this.pos[1] - event.clientY;

        let offsetRight = this.element.parentElement.offsetWidth - this.element.offsetLeft - this.element.offsetWidth
        if (this.element.offsetTop - this.pos[1] + this.element.offsetHeight > this.element.parentElement.offsetHeight)
            this.element.style.top = (this.element.parentElement.offsetHeight - this.element.offsetHeight) + "px";
        else
            this.element.style.top = (this.element.offsetTop - this.pos[1]) + "px";
        this.element.style.right = (offsetRight + this.pos[0]) + "px";

        this.stopListening();
    }

    stopListening() {
        this.element.parentElement.onmouseup = null;
    }
}

// Credit: https://stackoverflow.com/a/55644176/1836338
const fps = {
    sampleSize: 60,
    value: 0,
    _sample_: [],
    _index_: 0,
    _lastTick_: false,
    tick: function () {
        // if is first tick, just set tick timestamp and return
        if (!this._lastTick_) {
            this._lastTick_ = performance.now();
            return 0;
        }
        // calculate necessary values to obtain current tick FPS
        let now = performance.now();
        let delta = (now - this._lastTick_) / 1000;
        let fps = 1 / delta;
        // add to fps samples, current tick fps value 
        this._sample_[this._index_] = Math.round(fps);

        // iterate samples to obtain the average
        let average = 0;
        for (i = 0; i < this._sample_.length; i++) average += this._sample_[i];

        average = Math.round(average / this._sample_.length);

        // set new FPS
        this.value = average;
        // store current timestamp
        this._lastTick_ = now;
        // increase sample index counter, and reset it
        // to 0 if exceded maximum sampleSize limit
        this._index_++;
        if (this._index_ === this.sampleSize) this._index_ = 0;
        return this.value;
    }
}

