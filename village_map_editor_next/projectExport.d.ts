import type { IncomingMessage, ServerResponse } from "node:http";

export const PROJECT_ROOT: string;
export function sanitizeExportFileName(fileName: unknown): string;
export function writeProjectExportFile(
  fileName: unknown,
  content: string,
  root?: string,
): Promise<{ fileName: string; path: string }>;
export function handleProjectExportRequest(request: IncomingMessage, response: ServerResponse, root?: string): Promise<void>;
