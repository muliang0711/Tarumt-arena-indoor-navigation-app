import type { EditorState } from "../app/editorState";
import type { MapDocumentV2 } from "./schema";
import { validateMapDocument } from "./validation";

export interface ExportResult {
  document: MapDocumentV2;
  errors: string[];
}

export function exportMapDocument(state: EditorState): ExportResult {
  const document = structuredClone(state.document) as MapDocumentV2;
  return {
    document,
    errors: validateMapDocument(document),
  };
}

export function mapDocumentToJson(document: MapDocumentV2): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
