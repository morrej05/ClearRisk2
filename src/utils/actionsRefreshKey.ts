/**
 * Generates a unique refresh key for actions associated with a document and module instance.
 * This key is used to force re-fetching of actions when module state changes.
 */
export function getActionsRefreshKey(documentId: string, moduleInstanceId: string): string {
  return `${documentId}-${moduleInstanceId}`;
}
