const state = {
    brushSize: 10,
    color: '#009dff',
    history: [],
    historyIndex: -1,
    scale: 1,
    panning: false,
    panStart: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    drawing: false,
    pixelPerfect: false,
    currentStroke: []
};

const els = {
    startScreen: document.getElementById('start-screen'),
    workspace: document.getElementById('workspace'),
    canvas: document.getElementById('main-canvas'),
    wrapper: document.getElementById('canvas-wrapper'),
    colorTrigger: document.getElementById('color-picker-trigger'),
    realColor: document.getElementById('real-color-picker'),
    sliderTrack: document.getElementById('slider-track'),
    sliderThumb: document.getElementById('slider-thumb'),
    sliderFill: document.getElementById('slider-fill'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    btnDownload: document.getElementById('btn-download'),
    btnInfo: document.getElementById('btn-info'),
    btnPixel: document.getElementById('btn-pixel'),
    panelInfo: document.getElementById('panel-info'),
    infoWidth: document.getElementById('info-width'),
    infoHeight: document.getElementById('info-height'),
    infoSize: document.getElementById('info-size'),
};

const ctx = els.canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

document.querySelectorAll('.panel').forEach(panel => {
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mouseup', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());
});

window.addEventListener('paste', async (e) => {
    e.preventDefault();
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
                initWorkspace(img, blob.size);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        }
    }
});

function initWorkspace(img, sizeBytes) {
    els.startScreen.style.display = 'none';
    els.workspace.style.display = 'block';

    els.canvas.width = img.width;
    els.canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    els.infoWidth.textContent = img.width;
    els.infoHeight.textContent = img.height;
    els.infoSize.textContent = (sizeBytes / 1024).toFixed(2) + ' KB';

    state.scale = 1;
    state.offset = { x: 0, y: 0 };
    updateTransform();

    state.history = [];
    state.historyIndex = -1;
    saveState();
}

function getMousePos(e) {
    const rect = els.canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / state.scale,
        y: (e.clientY - rect.top) / state.scale
    };
}

els.workspace.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        sliderDragging = false;
        state.drawing = true;
        state.currentStroke = [];
        const pos = getMousePos(e);
        state.currentStroke.push(pos);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = state.color;
        ctx.fillStyle = state.color;
        ctx.lineWidth = Math.max(1, state.brushSize / Math.max(0.0001, state.scale));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    } else if (e.button === 1) {
        e.preventDefault();
        state.panning = true;
        state.panStart = { x: e.clientX - state.offset.x, y: e.clientY - state.offset.y };
    }
});

window.addEventListener('mousemove', (e) => {
    if (state.drawing) {
        const pos = getMousePos(e);
        const last = state.currentStroke[state.currentStroke.length - 1];
        state.currentStroke.push(pos);
        const mid = { x: (last.x + pos.x) / 2, y: (last.y + pos.y) / 2 };
        ctx.strokeStyle = state.color;
        ctx.lineWidth = Math.max(1, state.brushSize / Math.max(0.0001, state.scale));
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
    }
    if (state.panning) {
        state.offset.x = e.clientX - state.panStart.x;
        state.offset.y = e.clientY - state.panStart.y;
        updateTransform();
    }
});

window.addEventListener('mouseup', (e) => {
    if (state.drawing) {
        state.drawing = false;
        if (state.currentStroke.length === 1) {
            const p = state.currentStroke[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, (state.brushSize / Math.max(0.0001, state.scale)) / 2), 0, Math.PI * 2);
            ctx.fillStyle = state.color;
            ctx.fill();
        } else {
            const last = state.currentStroke[state.currentStroke.length - 1];
            ctx.lineWidth = Math.max(1, state.brushSize / Math.max(0.0001, state.scale));
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        }
        ctx.closePath();
        state.currentStroke = [];
        saveState();
    }
    if (state.panning) {
        state.panning = false;
    }
});

function updateTransform() {
    els.wrapper.style.transform = `translate(calc(-50% + ${state.offset.x}px), calc(-50% + ${state.offset.y}px)) scale(${state.scale})`;
}

window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = state.scale * delta;
        const rect = els.wrapper.getBoundingClientRect();
        const mx = e.clientX;
        const my = e.clientY;
        const canvasWidth = els.canvas.width;
        const canvasHeight = els.canvas.height;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const baseLeftCurr = centerX - (canvasWidth * state.scale) / 2;
        const baseTopCurr = centerY - (canvasHeight * state.scale) / 2;
        const wrapperLeftCurr = baseLeftCurr + state.offset.x;
        const wrapperTopCurr = baseTopCurr + state.offset.y;
        const canvasPointX = (mx - wrapperLeftCurr) / state.scale;
        const canvasPointY = (my - wrapperTopCurr) / state.scale;
        const baseLeftNew = centerX - (canvasWidth * newScale) / 2;
        const baseTopNew = centerY - (canvasHeight * newScale) / 2;
        const desiredWrapperLeft = mx - canvasPointX * newScale;
        const desiredWrapperTop = my - canvasPointY * newScale;
        state.scale = newScale;
        state.offset.x = desiredWrapperLeft - baseLeftNew;
        state.offset.y = desiredWrapperTop - baseTopNew;
        updateTransform();
    }
}, { passive: false });

function saveState() {
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    state.history.push(ctx.getImageData(0, 0, els.canvas.width, els.canvas.height));
    state.historyIndex++;
    updateHistoryButtons();
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        ctx.putImageData(state.history[state.historyIndex], 0, 0);
        updateHistoryButtons();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        ctx.putImageData(state.history[state.historyIndex], 0, 0);
        updateHistoryButtons();
    }
}

function updateHistoryButtons() {
    if (state.historyIndex > 0) els.btnUndo.classList.remove('disabled');
    else els.btnUndo.classList.add('disabled');

    if (state.historyIndex < state.history.length - 1) els.btnRedo.classList.remove('disabled');
    else els.btnRedo.classList.add('disabled');
}

window.addEventListener('keydown', (e) => {
    const cmd = e.ctrlKey || e.metaKey;

    if (!cmd) return;
    if (e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }

    if (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ')) {
        e.preventDefault();
        redo();
    }

    if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        state.scale *= 1.1;
        updateTransform();
    }
    if (e.key === '-') {
        e.preventDefault();
        state.scale *= 0.9;
        updateTransform();
    }
});

els.colorTrigger.addEventListener('click', (e) => {
    els.realColor.click();
});

els.realColor.addEventListener('input', (e) => {
    state.color = e.target.value;
    els.colorTrigger.style.backgroundColor = state.color;
});
els.realColor.addEventListener('click', (e) => e.stopPropagation());

function updateSlider(percent) {
    percent = Math.max(0, Math.min(1, percent));
    els.sliderThumb.style.bottom = (percent * 100) + '%';
    els.sliderFill.style.height = (percent * 100) + '%';
    state.brushSize = 1 + (percent * 49);
}

updateSlider((10 - 1) / 49);

let sliderDragging = false;
let activePointerId = null;

els.sliderTrack.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sliderDragging = true;
    activePointerId = e.pointerId;
    try { els.sliderTrack.setPointerCapture(activePointerId); } catch (err) { }
    moveSlide(e);
});

els.sliderTrack.addEventListener('pointermove', (e) => {
    if (!sliderDragging) return;
    moveSlide(e);
});

els.sliderTrack.addEventListener('pointerup', (e) => {
    sliderDragging = false;
    activePointerId = null;
    try { els.sliderTrack.releasePointerCapture(e.pointerId); } catch (err) { }
});

els.sliderTrack.addEventListener('pointercancel', () => {
    sliderDragging = false;
    activePointerId = null;
});

function moveSlide(e) {
    if (!sliderDragging) return;
    const rect = els.sliderTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const percent = 1 - (y / height);
    updateSlider(percent);
}

els.btnUndo.addEventListener('click', (e) => {
    if (!els.btnUndo.classList.contains('disabled')) undo();
});
els.btnRedo.addEventListener('click', (e) => {
    if (!els.btnRedo.classList.contains('disabled')) redo();
});

els.btnFullscreen.addEventListener('click', () => {
    document.body.classList.toggle('fullscreen-mode');
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
    }
});

els.btnDownload.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = els.canvas.toDataURL();
    link.click();
});

els.btnInfo.addEventListener('click', () => {
    els.panelInfo.classList.toggle('visible');
});

els.btnPixel.addEventListener('click', () => {
    state.pixelPerfect = !state.pixelPerfect;
    if (state.pixelPerfect) {
        els.wrapper.classList.add('pixel-perfect');
        els.canvas.style.imageRendering = 'pixelated';
    } else {
        els.wrapper.classList.remove('pixel-perfect');
        els.canvas.style.imageRendering = 'auto';
    }
});
