/**
 * Application Entry Point
 *
 * Bootstraps Express server with the pathfinding API + MVP frontend.
 */

import express from 'express';
import * as path from 'path';
import { NodeRepository } from './repo/NodeRepository';
import { PathfindingService } from './service/PathfindingService';
import { PathController } from './controller/PathController';

const PORT = process.env.PORT || 3000;

// ── Bootstrap ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// ── CORS (development) ────────────────────────────────────
app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ── Dependency Injection ───────────────────────────────────
const repo = new NodeRepository();
const service = new PathfindingService(repo);
const controller = new PathController(service);

// ── API Routes ─────────────────────────────────────────────
app.use('/api', controller.router);

// ── Graph Data Endpoint (for frontend map) ─────────────────
app.get('/api/nodes', (_req, res) => {
    res.json({
        nodes: repo.getAllNodes(),
        edges: repo.getAllEdges(),
    });
});

// ── Health Check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve Frontend ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'mvp_frontend')));

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Pathfinding API running at http://localhost:${PORT}`);
    console.log(`   GET /api/path?start={node_id}&end={node_id}`);
    console.log(`   GET /api/nodes`);
    console.log(`   GET /health`);
    console.log(`   Frontend: http://localhost:${PORT}\n`);
});
