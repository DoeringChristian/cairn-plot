import type { RuntimeStoreEntry } from "./runtime-store.ts";

/** Host-provided access to content-addressed artifacts. */
export interface DataSource {
  artifactUrl(hash: string): string;
  bytes(hash: string): Promise<ArrayBuffer>;
  runtime?(hash: string): RuntimeStoreEntry | undefined;
}

/** Network-backed artifact source used by embedded hosts such as Cairn. */
export function createEndpointDataSource(
  artifactUrl: (hash: string) => string,
  options: { fetch?: typeof fetch; requestInit?: RequestInit } = {},
): DataSource {
  const fetchArtifact = options.fetch ?? fetch;
  return {
    artifactUrl,
    async bytes(hash: string): Promise<ArrayBuffer> {
      const response = await fetchArtifact(artifactUrl(hash), options.requestInit);
      if (!response.ok) {
        throw new Error(`failed to fetch artifact ${hash} (${response.status})`);
      }
      return response.arrayBuffer();
    },
  };
}
