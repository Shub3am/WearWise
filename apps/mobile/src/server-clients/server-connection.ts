// Why: the one shape both server clients take, so tests pass a fake fetch and a fake session token.
// Must not: import fetch, Clerk or config; callers build the connection.
export type ServerRequest = {
  method: "GET" | "POST" | "PATCH";
  headers: Record<string, string>;
  body?: string | Uint8Array<ArrayBuffer>;
};

export type ServerResponse = { status: number; json(): Promise<unknown> };

export type FetchFromServer = (
  url: string,
  request: ServerRequest,
) => Promise<ServerResponse>;

export type ServerConnection = {
  baseUrl: string;
  fetchFromServer: FetchFromServer;
  getSessionToken: () => Promise<string | null>;
};
