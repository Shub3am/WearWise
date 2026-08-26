// Why: gives screens the API connection and ingest url for the signed in user, from Clerk and the public config.
// Must not: be called outside the root navigator's signed in screens; it needs ClerkProvider and the public config.
import { useAuth } from "@clerk/expo";
import { fetch } from "expo/fetch";
import { useMemo } from "react";
import { readPublicConfig } from "../config/public-config.ts";
import type { ServerConnection } from "../server-clients/server-connection.ts";

export type ServerAccess = {
  apiConnection: ServerConnection;
  ingestUrl: string;
};

export function useServerAccess(): ServerAccess {
  const { getToken } = useAuth({ treatPendingAsSignedOut: false });
  return useMemo(() => {
    const publicConfig = readPublicConfig();
    if (publicConfig === undefined) {
      throw new Error(
        "useServerAccess ran without the public config; the root navigator renders no screen then",
      );
    }
    return {
      apiConnection: {
        baseUrl: publicConfig.apiUrl,
        fetchFromServer: fetch,
        getSessionToken: () => getToken(),
      },
      ingestUrl: publicConfig.ingestUrl,
    };
  }, [getToken]);
}
