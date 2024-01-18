import {
  QueryClientProvider,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import objectHash from "object-hash";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useSnapshot } from "valtio";

import { MissingOptProviderError } from "./error";
import {
  NormalizeOptionalFields,
  internalFetch,
  type ApiBase,
  type MutateId,
  type OptCacheStore,
  type OptClient,
  type ResourceId,
} from "./internal";
import type {
  Method,
  NormalizeHeaders,
  OptAction,
  OptGet,
  OptMutationRouteConfig,
  OptResourceHashFn,
  OptResourceRouteConfig,
  OptSet,
} from "./types";

const OptContext = createContext<unknown>(undefined!);

export function OptProvider<Api extends ApiBase<Api>>({
  children,
  client,
}: { children: React.ReactNode; client: OptClient<Api> }) {
  return (
    <OptContext.Provider value={client}>
      <QueryClientProvider client={client.queryClient}>
        {children}
      </QueryClientProvider>
    </OptContext.Provider>
  );
}

export function useOpt<Api extends ApiBase<Api>>() {
  const context = useContext(OptContext) as OptClient<Api> | undefined;
  if (!context) {
    throw new MissingOptProviderError();
  }

  // @ts-ignore
  const optStoreSnapshot: OptCacheStore<Api> = useSnapshot(context.optStore);

  const get: OptGet<Api> = useCallback(
    <Res extends ResourceId<Api>>(
      resourceId: Res,
      params: Api[`GET ${Res}` & keyof Api]["params"],
    ): Api[`GET ${Res}` & keyof Api]["data"] | undefined => {
      type ApiId = `GET ${ResourceId<Api>}` & keyof Api;
      type HashFn = OptResourceHashFn<Api, ApiId>;
      const route = context.config.routes?.[
        `GET ${resourceId}` as ApiId
      ] as OptResourceRouteConfig<Api, ApiId>;
      const hashFn = route?.hash ?? (objectHash as HashFn);
      const hash = hashFn(params);

      if (optStoreSnapshot[resourceId]?.[hash] !== undefined) {
        return optStoreSnapshot[resourceId]![hash];
      }

      return route.defaultValue === undefined
        ? undefined
        : typeof route.defaultValue === "function"
          ? (
              route.defaultValue as (
                params: Api[ApiId]["params"],
              ) => Api[ApiId]["data"] | undefined
            )(params)
          : route.defaultValue;
    },
    [optStoreSnapshot, context.config.routes],
  );

  const set: OptSet<Api> = useCallback(
    <Res extends ResourceId<Api>>(
      resourceId: Res,
      params: Api[`GET ${Res}` & keyof Api]["params"],
      data: Api[`GET ${Res}` & keyof Api]["data"] | undefined,
      _sentAt?: number,
    ) => {
      type ApiId = `GET ${ResourceId<Api>}` & keyof Api;
      type HashFn = OptResourceHashFn<Api, ApiId>;

      const sentAt = _sentAt ?? Date.now();
      const hashFn =
        (
          context.config.routes?.[`GET ${resourceId}` as ApiId] as {
            hash?: HashFn;
          }
        )?.hash ?? (objectHash as HashFn);
      const hash = hashFn(params);

      // Update cache store
      context.cacheStore[resourceId] ??= {};
      // @ts-ignore
      context.cacheStore[resourceId][hash] ??= {};
      context.cacheStore[resourceId]![hash]!.data = data;
      context.cacheStore[resourceId]![hash]!.sentAt = sentAt;

      // Update mutation store
      let actions: ((
        prev: Api[`GET ${Res}` & keyof Api]["data"] | undefined,
        get: OptGet<Api>,
      ) => Api[`GET ${Res}` & keyof Api]["data"] | undefined)[] = [];
      if (context.actionStore[resourceId]?.[hash]) {
        // @ts-ignore
        context.actionStore[resourceId][hash] = context.actionStore[resourceId][
          hash
        ].filter(({ createdAt }) => createdAt > sentAt);
        actions = context.actionStore[resourceId]![hash]!.map(({ fn }) => fn);
      }

      // Update opt store
      context.optStore[resourceId] ??= {};
      // @ts-ignore
      context.optStore[resourceId][hash] = actions.reduce(
        (data, fn) => fn(data, get),
        data,
      );
    },
    [
      context.config.routes,
      context.cacheStore,
      context.actionStore,
      context.optStore,
      get,
    ],
  );

  const useOptQuery = useCallback(
    <Res extends ResourceId<Api>>({
      // @ts-ignore
      resourceId,
      // @ts-ignore
      params,
      // @ts-ignore
      headers,
      ...options
    }: NormalizeOptionalFields<
      {
        resourceId: Res;
        params: Api[`GET ${Res}` & keyof Api]["params"];
        headers: Api[`GET ${Res}` & keyof Api]["requestHeaders"];
      } & Omit<UseQueryOptions, "queryFn" | "queryKey">
    >) => {
      type ApiId = `GET ${ResourceId<Api>}` & keyof Api;
      type HashFn = OptResourceHashFn<Api, ApiId>;
      const hashFn =
        (
          context.config.routes?.[`GET ${resourceId}` as ApiId] as {
            hash?: HashFn;
          }
        )?.hash ?? (objectHash as HashFn);

      const { data: last, ...rest } = useQuery({
        queryKey: [resourceId, hashFn(params)],
        queryFn: async () => {
          const sentAt = Date.now();

          return internalFetch<
            Api[ApiId]["data"],
            Api[ApiId]["requestHeaders"]
          >({
            baseUrl: context.config.baseUrl,
            method: "GET",
            path: resourceId,
            params,
            headers,
          }).then((response) => {
            set(resourceId, params, response.data, sentAt);
            return response;
          });
        },
        ...options,
      });

      const data = useMemo(() => get(resourceId, params), [resourceId, params]);

      return { data, last, ...rest };
    },
    [context.config.baseUrl, context.config.routes, set, get],
  );

  const optMutate = useCallback(
    async <ApiId extends MutateId<Api> & string>({
      apiId,
      params,
      headers,
      body,
    }: {
      apiId: ApiId;
      params: Api[ApiId]["params"];
      headers: NormalizeHeaders<Api[ApiId]["requestHeaders"]>;
      body: Api[ApiId]["body"];
    }) => {
      const createdAt = Date.now();

      const route = context.config.routes?.[apiId] as OptMutationRouteConfig<
        Api,
        ApiId
      >;

      // update actions
      const changedActionKeys: [resourceId: ResourceId<Api>, hash: string][] =
        [];
      const actions: OptAction<Api, ResourceId<Api>>[] =
        route?.actions?.({
          params,
          headers,
          body,
        }) ?? [];
      for (const { resourceId, params, fn } of actions) {
        type HashFn = OptResourceHashFn<
          Api,
          `GET ${ResourceId<Api>}` & keyof Api
        >;
        const hashFn: HashFn =
          // @ts-ignore
          context.config.routes?.[`GET ${resourceId}` as ApiId]?.hash ??
          objectHash;
        const hash = hashFn(params);
        context.actionStore[resourceId] ??= {};
        // @ts-ignore
        context.actionStore[resourceId]![hash] = [
          ...(context.actionStore[resourceId]![hash] ?? []),
          { fn, createdAt },
        ];

        if (
          !changedActionKeys.some(([id, h]) => id === resourceId && h === hash)
        ) {
          changedActionKeys.push([resourceId, hash]);
        }
      }

      // update opt store
      for (const [resourceId, hash] of changedActionKeys) {
        const cache = context.cacheStore[resourceId]?.[hash];
        context.optStore[resourceId] ??= {};
        // @ts-ignore
        context.optStore[resourceId][hash] =
          // @ts-ignore
          (context.actionStore[resourceId][hash] ?? []).reduce(
            (data, action) => {
              if (cache && action.createdAt < cache.sentAt) {
                return data;
              }
              return action.fn(data, get);
            },
            cache?.data,
          );
      }

      const method = apiId.split(" ")[0] as Method;
      const result = (await internalFetch({
        baseUrl: context.config.baseUrl,
        method,
        path: apiId.slice(method.length + 1),
        params,
        headers,
        body,
      })) as {
        data: Api[ApiId]["data"];
        headers: NormalizeHeaders<Api[ApiId]["responseHeaders"]>;
      };

      route.onResponse?.({
        ...result,
        request: { params, headers, body },
        get,
        set: (r, p, d) => set(r, p, d, createdAt),
      });

      return result;
    },
    [
      context.config.routes,
      context.cacheStore,
      context.actionStore,
      context.optStore,
      context.config.baseUrl,
      get,
      set,
    ],
  );

  return { useQuery: useOptQuery, mutate: optMutate, get, set };
}
