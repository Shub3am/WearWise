// Why: gives screens the API connection and ingest url for the signed in user, from Clerk and the public config.
// Must not: be called outside the root navigator's signed in screens; it needs ClerkProvider and the public config.
import { useAuth } from "@clerk/expo";
import { fetch } from "expo/fetch";
import { useMemo, useRef } from "react";
import { readPublicConfig } from "../config/public-config.ts";
import type { ServerConnection } from "../server-clients/server-connection.ts";

export type ServerAccess = {
  apiConnection: ServerConnection;
  ingestUrl: string;
};

export function useServerAccess(): ServerAccess {
  const { getToken } = useAuth({ treatPendingAsSignedOut: false });
  // @clerk/expo's useAuth wraps @clerk/react's memoized getToken in a new closure on every render,
  // so a ref (read fresh on every call, never a useMemo dependency) is what keeps ServerAccess stable.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
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
        getSessionToken: () => getTokenRef.current(),
      },
      ingestUrl: publicConfig.ingestUrl,
    };
  }, []);
}
