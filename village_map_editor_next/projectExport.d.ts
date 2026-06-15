import type { IncomingMessage, ServerResponse } from "node:http";

export const PROJECT_ROOT: string;
export const GENERATED_MAP_DIR: string;
export const NODE_SYSTEM_DIR: string;
export function sanitizeExportFileName(fileName: unknown): string;
export function writeProjectExportFile(
  fileName: unknown,
  content: string,
  root?: string,
): Promise<{ fileName: string; path: string }>;
export function writeNodeSystemExportFiles(
  files: Array<{ fileName: unknown; content: string }>,
  root?: string,
): Promise<Array<{ fileName: string; path: string }>>;
export function handleProjectExportRequest(request: IncomingMessage, response: ServerResponse, root?: string): Promise<void>;
