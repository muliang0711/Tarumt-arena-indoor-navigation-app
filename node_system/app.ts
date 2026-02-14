/**
 * Application Entry Point
 *
 * Bootstraps Express server with the pathfinding API.
 */

import express from 'express';
import { NodeRepository } from './repo/NodeRepository';
import { PathfindingService } from './service/PathfindingService';
import { PathController } from './controller/PathController';

const PORT = process.env.PORT || 3000;

// ── Bootstrap ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// ── Dependency Injection ───────────────────────────────────
const repo = new NodeRepository();
const service = new PathfindingService(repo);
const controller = new PathController(service);

// ── Routes ─────────────────────────────────────────────────
app.use('/api', controller.router);

// ── Health Check ───────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Pathfinding API running at http://localhost:${PORT}`);
    console.log(`   GET /api/path?start={node_id}&end={node_id}`);
    console.log(`   GET /health\n`);
});
