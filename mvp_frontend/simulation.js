// ═══════════════════════════════════════════════════════════
//  simulation.js — Walking, Sensor Drift & WiFi Correction
// ═══════════════════════════════════════════════════════════

const API_BASE = '';
const SCALE = 60;
const ORIGIN_X = 150;
const ORIGIN_Y = 240;

// ── Color / Size Maps ──────────────────────────────────────
const NODE_COLORS = {
    junction: '#60a5fa', corridor_turn: '#60a5fa', room: '#34d399',
    elevator: '#fbbf24', toilet: '#f472b6', stairs: '#c084fc',
    exit: '#fb923c', entrance: '#fb923c'
};
const NODE_RADIUS = {
    junction: 9, corridor_turn: 6, room: 8, elevator: 9,
    toilet: 7, stairs: 8, exit: 8, entrance: 8
};

// ── State ──────────────────────────────────────────────────
let nodes = [], edges = [], nodeMap = {};
let startNode = null, endNode = null, pathResult = null;

// Simulation state
let simRunning = false, simAnimId = null;
let simPath = [];           // array of {sx, sy, node} along the route
let simProgress = 0;        // 0..1 across entire path
let simIdealPos = { sx: 0, sy: 0 };
let simSensorPos = { sx: 0, sy: 0 };
let simCorrectedPos = { sx: 0, sy: 0 };
let simDriftAccumX = 0, simDriftAccumY = 0;
let simLastTime = 0;
let simTrailPoints = [];
let simCorrectionEnabled = true;
let simLastCorrectionTime = 0;
const CORRECTION_INTERVAL = 2000; // ms between WiFi corrections

// ── Helpers ────────────────────────────────────────────────
function toSvg(x, y) {
    return { sx: ORIGIN_X + x * SCALE, sy: ORIGIN_Y - y * SCALE };
}
function fromSvg(sx, sy) {
    return { x: (sx - ORIGIN_X) / SCALE, y: (ORIGIN_Y - sy) / SCALE };
}
function gaussRandom() {
    // Box-Muller transform
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
function dist(a, b) {
    return Math.sqrt((a.sx - b.sx) ** 2 + (a.sy - b.sy) ** 2);
}
function lerp(a, b, t) {
    return { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t };
}

// ── Init ───────────────────────────────────────────────────
async function init() {
    try {
        const res = await fetch(`${API_BASE}/api/nodes`);
        const data = await res.json();
        nodes = data.nodes;
        edges = data.edges;
        nodeMap = {};
        nodes.forEach(n => nodeMap[n.node_id] = n);
        renderMap();
        setupSliders();
    } catch (err) {
        console.error('Failed to load graph data:', err);
    }
}

function setupSliders() {
    document.getElementById('speedSlider').addEventListener('input', e => {
        document.getElementById('speedVal').textContent = e.target.value + 'x';
    });
    document.getElementById('driftSlider').addEventListener('input', e => {
        document.getElementById('driftVal').textContent = e.target.value + 'x';
    });
}

// ── Render Map ─────────────────────────────────────────────
function renderMap() {
    const eg = document.getElementById('edgesGroup');
    const ng = document.getElementById('nodesGroup');
    const lg = document.getElementById('labelsGroup');
    eg.innerHTML = ''; ng.innerHTML = ''; lg.innerHTML = '';
    document.getElementById('badgesGroup').innerHTML = '';
    document.getElementById('probRingsGroup').innerHTML = '';

    edges.forEach(edge => {
        const fn = nodeMap[edge.from_node], tn = nodeMap[edge.to_node];
        if (!fn || !tn) return;
        const f = toSvg(fn.x, fn.y), t = toSvg(tn.x, tn.y);
        const line = svgEl('line', { x1: f.sx, y1: f.sy, x2: t.sx, y2: t.sy, class: 'edge-line', 'data-edge-id': edge.edge_id });
        eg.appendChild(line);
    });

    nodes.forEach(node => {
        const p = toSvg(node.x, node.y);
        const color = NODE_COLORS[node.type] || '#60a5fa';
        const r = NODE_RADIUS[node.type] || 7;
        const c = svgEl('circle', { cx: p.sx, cy: p.sy, r, fill: color, class: 'node-circle', 'data-node-id': node.node_id });
        c.addEventListener('click', () => onNodeClick(node.node_id));
        ng.appendChild(c);
        const lbl = svgEl('text', { x: p.sx, y: p.sy + r + 10, class: 'node-label', 'data-label-for': node.node_id });
        lbl.textContent = node.name || node.node_id;
        lg.appendChild(lbl);
    });
}

function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

// ── Node Click ─────────────────────────────────────────────
function onNodeClick(nodeId) {
    if (simRunning) return;
    if (!startNode) {
        startNode = nodeId;
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('start');
        document.getElementById('startLabel').textContent = nodeMap[nodeId]?.name || nodeId;
        document.getElementById('promptText').innerHTML = '<strong>Start set!</strong> Click another node for destination.';
        addBadge(nodeId, 'S', '#34d399');
    } else if (!endNode && nodeId !== startNode) {
        endNode = nodeId;
        document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('end');
        document.getElementById('endLabel').textContent = nodeMap[nodeId]?.name || nodeId;
        addBadge(nodeId, 'E', '#f472b6');
        findPath();
    }
}

function addBadge(nodeId, letter, color) {
    const node = nodeMap[nodeId]; if (!node) return;
    const p = toSvg(node.x, node.y), r = NODE_RADIUS[node.type] || 7;
    const g = document.getElementById('badgesGroup');
    g.appendChild(svgEl('circle', { cx: p.sx + r + 5, cy: p.sy - r - 3, r: 7, fill: color }));
    const t = svgEl('text', { x: p.sx + r + 5, y: p.sy - r - 3, class: 'badge-text', fill: '#0f1117' });
    t.textContent = letter; g.appendChild(t);
}

// ── Find Path ──────────────────────────────────────────────
async function findPath() {
    try {
        const res = await fetch(`${API_BASE}/api/path?start=${startNode}&end=${endNode}`);
        const data = await res.json();
        if (!data.success) {
            document.getElementById('promptText').innerHTML = `<strong style="color:#ef4444">Error:</strong> ${data.error}`;
            return;
        }
        pathResult = data.data;
        highlightPath(pathResult);
        showSteps(pathResult);
        document.getElementById('walkBtn').disabled = false;
    } catch (err) {
        document.getElementById('promptText').innerHTML = '<strong style="color:#ef4444">Network error.</strong>';
    }
}

function highlightPath(result) {
    const ids = result.path.map(n => n.node_id);
    for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i], b = ids[i + 1];
        edges.forEach(e => {
            if ((e.from_node === a && e.to_node === b) || (e.from_node === b && e.to_node === a)) {
                document.querySelector(`[data-edge-id="${e.edge_id}"]`)?.classList.add('highlighted');
            }
        });
    }
    ids.forEach(id => {
        if (id === startNode || id === endNode) return;
        document.querySelector(`[data-node-id="${id}"]`)?.classList.add('on-path');
        document.querySelector(`[data-label-for="${id}"]`)?.classList.add('highlighted');
    });
    document.querySelector(`[data-label-for="${startNode}"]`)?.classList.add('highlighted');
    document.querySelector(`[data-label-for="${endNode}"]`)?.classList.add('highlighted');
}

function showSteps(result) {
    const panel = document.getElementById('stepsPanel');
    panel.innerHTML = '';
    result.path.forEach((node, i) => {
        const d = document.createElement('div');
        d.className = 'step-item';
        d.style.animationDelay = `${i * 0.06}s`;
        let extra = i === 0 ? ' — Start' : i === result.path.length - 1 ? ' — Dest' : '';
        d.innerHTML = `<div class="step-num">${i + 1}</div><div><div class="step-name">${node.name || node.node_id}${extra}</div><div class="step-type">${node.type.replace('_', ' ')} · ${node.node_id}</div></div>`;
        panel.appendChild(d);
    });
}

// ═══════════════════════════════════════════════════════════
//  WALKING SIMULATION
// ═══════════════════════════════════════════════════════════

function startWalking() {
    if (!pathResult || simRunning) return;

    // Build sim waypoints
    simPath = pathResult.path.map(n => {
        const p = toSvg(n.x, n.y);
        return { sx: p.sx, sy: p.sy, node: n };
    });

    simProgress = 0;
    simDriftAccumX = 0;
    simDriftAccumY = 0;
    simTrailPoints = [];
    simLastTime = performance.now();
    simLastCorrectionTime = simLastTime;
    simRunning = true;

    // Show avatar
    const start = simPath[0];
    simIdealPos = { ...start };
    simSensorPos = { ...start };
    simCorrectedPos = { ...start };
    setAvatarPos(start.sx, start.sy);
    showAvatar(true);

    // Update UI
    document.getElementById('walkBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    setStatus('walking', 'Walking');
    document.getElementById('logList').innerHTML = '';

    // Start loop
    simAnimId = requestAnimationFrame(simLoop);
}

function stopWalking() {
    simRunning = false;
    if (simAnimId) cancelAnimationFrame(simAnimId);
    simAnimId = null;
    document.getElementById('walkBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    setStatus('idle', 'Stopped');
}

function simLoop(timestamp) {
    if (!simRunning) return;

    const dt = (timestamp - simLastTime) / 1000; // seconds
    simLastTime = timestamp;

    const speed = parseFloat(document.getElementById('speedSlider').value);
    const driftMult = parseFloat(document.getElementById('driftSlider').value);

    // Total path length in SVG units
    let totalLen = 0;
    for (let i = 0; i < simPath.length - 1; i++) {
        totalLen += dist(simPath[i], simPath[i + 1]);
    }

    // Move progress (pixels per second = 30 * speed)
    const pxPerSec = 30 * speed;
    simProgress += (pxPerSec * dt) / totalLen;

    if (simProgress >= 1) {
        simProgress = 1;
        finishWalking();
    }

    // Calculate ideal position along path
    simIdealPos = getPositionOnPath(simProgress);

    // Add sensor drift (Gaussian noise accumulation)
    const noiseScale = 0.4 * driftMult * dt * 60; // scale with frame time
    simDriftAccumX += gaussRandom() * noiseScale;
    simDriftAccumY += gaussRandom() * noiseScale;

    // Clamp drift so it doesn't go crazy
    const maxDrift = 40 * driftMult;
    simDriftAccumX = Math.max(-maxDrift, Math.min(maxDrift, simDriftAccumX));
    simDriftAccumY = Math.max(-maxDrift, Math.min(maxDrift, simDriftAccumY));

    simSensorPos = {
        sx: simIdealPos.sx + simDriftAccumX,
        sy: simIdealPos.sy + simDriftAccumY,
    };

    // WiFi correction
    simCorrectionEnabled = document.getElementById('corrToggle').classList.contains('on');
    if (simCorrectionEnabled && (timestamp - simLastCorrectionTime) > CORRECTION_INTERVAL) {
        performWiFiCorrection(timestamp);
        simLastCorrectionTime = timestamp;
    }

    // Display position = corrected if enabled, else sensor
    const displayPos = simCorrectionEnabled ? simCorrectedPos : simSensorPos;

    // Add trail point
    simTrailPoints.push(`${simSensorPos.sx},${simSensorPos.sy}`);
    if (simTrailPoints.length > 500) simTrailPoints.shift();
    document.getElementById('driftTrail').setAttribute('points', simTrailPoints.join(' '));

    // Update avatar
    setAvatarPos(displayPos.sx, displayPos.sy);
    updateArrowDirection(simIdealPos, displayPos);

    // Update sensor data display
    updateSensorUI(dt, driftMult);

    if (simRunning) simAnimId = requestAnimationFrame(simLoop);
}

function getPositionOnPath(progress) {
    if (simPath.length < 2) return simPath[0] || { sx: 0, sy: 0 };

    // Calculate segment lengths
    const segLens = [];
    let total = 0;
    for (let i = 0; i < simPath.length - 1; i++) {
        const d = dist(simPath[i], simPath[i + 1]);
        segLens.push(d);
        total += d;
    }

    let targetDist = progress * total;
    for (let i = 0; i < segLens.length; i++) {
        if (targetDist <= segLens[i]) {
            const t = targetDist / segLens[i];
            return lerp(simPath[i], simPath[i + 1], t);
        }
        targetDist -= segLens[i];
    }
    return simPath[simPath.length - 1];
}

function finishWalking() {
    simRunning = false;
    if (simAnimId) cancelAnimationFrame(simAnimId);
    simAnimId = null;
    document.getElementById('stopBtn').disabled = true;
    setStatus('idle', 'Arrived');
}

// ── WiFi Correction ────────────────────────────────────────
function performWiFiCorrection(timestamp) {
    // Find nearby nodes and calculate probabilities based on distance
    const sensorWorld = fromSvg(simSensorPos.sx, simSensorPos.sy);
    const candidates = [];
    let totalWeight = 0;

    nodes.forEach(n => {
        const dx = n.x - sensorWorld.x;
        const dy = n.y - sensorWorld.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 3) { // within 3 grid units
            // Inverse distance weighting with noise for realism
            const w = 1 / (0.3 + d) + Math.abs(gaussRandom()) * 0.1;
            candidates.push({ node: n, distance: d, weight: w });
            totalWeight += w;
        }
    });

    if (candidates.length === 0) return;

    // Normalize to probabilities
    candidates.forEach(c => c.probability = c.weight / totalWeight);
    candidates.sort((a, b) => b.probability - a.probability);
    const top = candidates.slice(0, 4); // top 4

    // Calculate corrected position (weighted average)
    let cx = 0, cy = 0;
    top.forEach(c => {
        cx += c.node.x * c.probability;
        cy += c.node.y * c.probability;
    });
    // Renormalize if we sliced
    const topSum = top.reduce((s, c) => s + c.probability, 0);
    cx /= topSum; cy /= topSum;

    const corrSvg = toSvg(cx, cy);

    // Show correction arrow from sensor pos to corrected pos
    showCorrectionArrow(simSensorPos, corrSvg);

    // Show probability rings
    showProbRings(top);

    // Apply correction: blend towards corrected position
    simCorrectedPos = { sx: corrSvg.sx, sy: corrSvg.sy };
    // Also reduce accumulated drift
    const idealWorld = fromSvg(simIdealPos.sx, simIdealPos.sy);
    const corrWorld = fromSvg(corrSvg.sx, corrSvg.sy);
    simDriftAccumX = (corrWorld.x - idealWorld.x) * SCALE;
    simDriftAccumY = -(corrWorld.y - idealWorld.y) * SCALE; // flip Y back

    // Log
    addCorrectionLog(timestamp, top);

    setStatus('correcting', 'Correcting');
    setTimeout(() => { if (simRunning) setStatus('walking', 'Walking'); }, 400);
}

function showCorrectionArrow(from, to) {
    const arrow = document.getElementById('correctionArrow');
    arrow.setAttribute('x1', from.sx);
    arrow.setAttribute('y1', from.sy);
    arrow.setAttribute('x2', to.sx);
    arrow.setAttribute('y2', to.sy);
    arrow.style.display = '';
    arrow.style.opacity = '1';
    // Fade out
    setTimeout(() => { arrow.style.opacity = '0'; }, 800);
    setTimeout(() => { arrow.style.display = 'none'; }, 1200);
}

function showProbRings(candidates) {
    const g = document.getElementById('probRingsGroup');
    g.innerHTML = '';
    candidates.forEach(c => {
        const p = toSvg(c.node.x, c.node.y);
        const pct = (c.probability * 100).toFixed(0);
        const r = 12 + c.probability * 20;
        const color = c.probability > 0.5 ? '#34d399' : c.probability > 0.2 ? '#fbbf24' : '#71717a';

        const ring = svgEl('circle', { cx: p.sx, cy: p.sy, r, stroke: color, class: 'prob-ring visible', 'stroke-dasharray': `${c.probability * 2 * Math.PI * r} ${2 * Math.PI * r}` });
        g.appendChild(ring);

        const lbl = svgEl('text', { x: p.sx, y: p.sy - r - 4, class: 'prob-label', fill: color });
        lbl.textContent = `${pct}%`;
        g.appendChild(lbl);
    });
    // Fade out after 1.5s
    setTimeout(() => {
        g.querySelectorAll('.prob-ring').forEach(el => el.classList.remove('visible'));
        setTimeout(() => { g.innerHTML = ''; }, 400);
    }, 1500);
}

function addCorrectionLog(timestamp, candidates) {
    const list = document.getElementById('logList');
    const logPrompt = document.getElementById('logPrompt');
    if (logPrompt) logPrompt.remove();

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const d = document.createElement('div');
    d.className = 'log-item';
    let probs = candidates.slice(0, 3).map(c => {
        const pct = (c.probability * 100).toFixed(0);
        const color = c.probability > 0.5 ? '#34d399' : c.probability > 0.2 ? '#fbbf24' : '#71717a';
        return `<span class="log-prob" style="background:${color}22;color:${color}">${c.node.name || c.node.node_id} ${pct}%</span>`;
    }).join(' ');
    d.innerHTML = `<div class="lt">${time}</div><div class="ln">WiFi scan → ${probs}</div>`;

    list.insertBefore(d, list.firstChild);
    // Keep max 20 entries
    while (list.children.length > 20) list.removeChild(list.lastChild);
}

// ── Avatar Visuals ─────────────────────────────────────────
function showAvatar(show) {
    const disp = show ? '' : 'none';
    document.getElementById('avatarPulse').style.display = disp;
    document.getElementById('avatarDot').style.display = disp;
    document.getElementById('avatarArrow').style.display = disp;
}

function setAvatarPos(sx, sy) {
    document.getElementById('avatarPulse').setAttribute('cx', sx);
    document.getElementById('avatarPulse').setAttribute('cy', sy);
    document.getElementById('avatarDot').setAttribute('cx', sx);
    document.getElementById('avatarDot').setAttribute('cy', sy);
}

function updateArrowDirection(ideal, current) {
    // Point arrow in the direction of movement (ideal heading)
    const dx = ideal.sx - current.sx;
    const dy = ideal.sy - current.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;

    const nx = dx / len, ny = dy / len;
    const cx = current.sx, cy = current.sy;
    const tipLen = 12;
    const wingLen = 5;

    const tipX = cx + nx * tipLen;
    const tipY = cy + ny * tipLen;
    const lx = cx + (-ny) * wingLen;
    const ly = cy + (nx) * wingLen;
    const rx = cx + (ny) * wingLen;
    const ry = cy + (-nx) * wingLen;

    document.getElementById('avatarArrow').setAttribute('points', `${lx},${ly} ${tipX},${tipY} ${rx},${ry}`);
}

function updateSensorUI(dt, driftMult) {
    // Simulated accelerometer (noise around 9.8 m/s²)
    const ax = (gaussRandom() * 0.3 * driftMult).toFixed(2);
    const ay = (gaussRandom() * 0.3 * driftMult).toFixed(2);
    document.getElementById('accX').textContent = ax;
    document.getElementById('accY').textContent = ay;

    // Heading
    const idealW = fromSvg(simIdealPos.sx, simIdealPos.sy);
    const sensorW = fromSvg(simSensorPos.sx, simSensorPos.sy);
    const heading = (Math.atan2(idealW.y - sensorW.y, idealW.x - sensorW.x) * 180 / Math.PI).toFixed(0);
    document.getElementById('heading').textContent = heading + '°';

    // Positions
    const iw = fromSvg(simIdealPos.sx, simIdealPos.sy);
    const sw = fromSvg(simSensorPos.sx, simSensorPos.sy);
    const cw = fromSvg(simCorrectedPos.sx, simCorrectedPos.sy);
    document.getElementById('posIdeal').textContent = `(${iw.x.toFixed(2)}, ${iw.y.toFixed(2)})`;
    document.getElementById('posSensor').textContent = `(${sw.x.toFixed(2)}, ${sw.y.toFixed(2)})`;
    document.getElementById('posCorrected').textContent = `(${cw.x.toFixed(2)}, ${cw.y.toFixed(2)})`;

    // Drift distance
    const driftD = Math.sqrt((iw.x - sw.x) ** 2 + (iw.y - sw.y) ** 2);
    document.getElementById('driftDist').textContent = driftD.toFixed(2) + ' m';
}

// ── Status Badge ───────────────────────────────────────────
function setStatus(cls, text) {
    const badge = document.getElementById('statusBadge');
    badge.className = 'status-badge ' + cls;
    badge.textContent = text;
}

// ── Toggle ─────────────────────────────────────────────────
function toggleCorrection() {
    const btn = document.getElementById('corrToggle');
    btn.classList.toggle('on');
}

// ── Reset ──────────────────────────────────────────────────
function resetAll() {
    stopWalking();
    startNode = null; endNode = null; pathResult = null;
    simProgress = 0; simDriftAccumX = 0; simDriftAccumY = 0;
    simTrailPoints = [];

    showAvatar(false);
    document.getElementById('driftTrail').setAttribute('points', '');
    document.getElementById('correctionArrow').style.display = 'none';
    document.getElementById('probRingsGroup').innerHTML = '';

    document.getElementById('startLabel').textContent = 'Click a node...';
    document.getElementById('endLabel').textContent = '—';
    document.getElementById('walkBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('stepsPanel').innerHTML = '<div class="prompt" id="promptText"><strong>Step 1:</strong> Click a node to set <strong>start</strong>.<br><br><strong>Step 2:</strong> Click another for <strong>destination</strong>.</div>';
    document.getElementById('logList').innerHTML = '<div class="prompt" id="logPrompt">Corrections will appear here during walking simulation.</div>';

    document.querySelectorAll('.node-circle').forEach(el => el.classList.remove('start', 'end', 'on-path'));
    document.querySelectorAll('.edge-line').forEach(el => el.classList.remove('highlighted'));
    document.querySelectorAll('.node-label').forEach(el => el.classList.remove('highlighted'));
    document.getElementById('badgesGroup').innerHTML = '';

    document.getElementById('accX').textContent = '0.00';
    document.getElementById('accY').textContent = '0.00';
    document.getElementById('heading').textContent = '0°';
    document.getElementById('posIdeal').textContent = '(0.00, 0.00)';
    document.getElementById('posSensor').textContent = '(0.00, 0.00)';
    document.getElementById('posCorrected').textContent = '(0.00, 0.00)';
    document.getElementById('driftDist').textContent = '0.00 m';
    setStatus('idle', 'Idle');
}

// ── Boot ───────────────────────────────────────────────────
init();
