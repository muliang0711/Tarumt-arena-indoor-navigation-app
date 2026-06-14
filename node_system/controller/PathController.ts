/**
 * Path Controller
 *
 * REST API controller for pathfinding.
 *
 * GET /api/path?start={node_id}&end={node_id}&algorithm={bfs|dijkstra}
 */

import { Router, Request, Response } from 'express';
import { PathfindingService, PathResult } from '../service/PathfindingService';

export class PathController {
    public router: Router;
    private service: PathfindingService;

    constructor(service: PathfindingService) {
        this.router = Router();
        this.service = service;
        this.registerRoutes();
    }

    private registerRoutes(): void {
        this.router.get('/path', this.findPath.bind(this));
    }

    /**
     * GET /api/path
     *
     * Query parameters:
     * - start: string (required) - Starting node_id
     * - end:   string (required) - Ending node_id
     * - algorithm: 'bfs' | 'dijkstra' (optional, default: 'bfs')
     */
    private findPath(req: Request, res: Response): void {
        try {
            const { start, end, algorithm } = req.query;

            // Validate required params
            if (!start || typeof start !== 'string') {
                res.status(400).json({ error: 'Missing or invalid "start" query parameter.' });
                return;
            }
            if (!end || typeof end !== 'string') {
                res.status(400).json({ error: 'Missing or invalid "end" query parameter.' });
                return;
            }

            // Choose algorithm (default to BFS for MVP)
            const algo = (typeof algorithm === 'string' ? algorithm.toLowerCase() : 'bfs') as string;

            let result: PathResult;

            switch (algo) {
                case 'dijkstra':
                    result = this.service.findPathDijkstra(start, end);
                    break;
                case 'bfs':
                default:
                    result = this.service.findPathBFS(start, end);
                    break;
            }

            res.json({
                success: true,
                data: {
                    path: result.path,
                    totalCost: result.totalCost,
                    algorithmUsed: result.algorithmUsed,
                    nodeCount: result.path.length,
                },
            });
        } catch (error: any) {
            const message = error.message || 'An unexpected error occurred.';
            const statusCode = message.includes('does not exist') ? 404 :
                message.includes('No path found') ? 404 :
                    message.includes('same') ? 400 : 500;

            res.status(statusCode).json({
                success: false,
                error: message,
            });
        }
    }
}
