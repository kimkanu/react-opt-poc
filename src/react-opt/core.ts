import { QueryClient } from "@tanstack/react-query";
import { proxy } from "valtio";
import type { ApiBase, OptClient } from "./internal";
import type { OptConfig } from "./types";

export function createOptClient<Api extends ApiBase<Api>>(
  config: OptConfig<Api>,
  queryClient?: QueryClient,
): OptClient<Api> {
  const _queryClient = queryClient ?? new QueryClient();

  const cacheStore = proxy();
  const actionStore = proxy();
  const optStore = proxy();

  return {
    queryClient: _queryClient,
    config,

    // stores
    cacheStore,
    actionStore,
    optStore,
  };
}
