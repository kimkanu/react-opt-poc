import { QueryClientConfig } from "@tanstack/react-query";
import { ApiBase, ResourceId } from "./internal";

/**
 * Supported HTTP methods type
 */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * Normalize header keys to lowercase
 */
export type NormalizeHeaders<
  T extends Record<string, string | undefined> | undefined,
> = T extends undefined
  ? undefined
  : {
      [K in keyof T & string as Lowercase<K>]: T[K];
    };

export type OptGet<Api extends ApiBase<Api>> = <Res extends ResourceId<Api>>(
  resourceId: Res,
  params: Api[`GET ${Res}` & keyof Api]["params"],
) => Api[`GET ${Res}` & keyof Api]["data"] | undefined;

export type OptSet<Api extends ApiBase<Api>> = <Res extends ResourceId<Api>>(
  resourceId: Res,
  params: Api[`GET ${Res}` & keyof Api]["params"],
  data: Api[`GET ${Res}` & keyof Api]["data"] | undefined,
  setAt?: number,
) => void;

export type OptSetWithSentAt<Api extends ApiBase<Api>> = <
  Res extends ResourceId<Api>,
>(
  resourceId: Res,
  params: Api[`GET ${Res}` & keyof Api]["params"],
  data: Api[`GET ${Res}` & keyof Api]["data"] | undefined,
) => void;

export type OptAction<Api extends ApiBase<Api>, Res extends ResourceId<Api>> = {
  resourceId: Res;
  params: Api[`GET ${Res}` & keyof Api]["params"];
  fn: (
    prev: Api[`GET ${Res}` & keyof Api]["data"],
    get: OptGet<Api>,
  ) => Api[`GET ${Res}` & keyof Api]["data"];
};

export type OptConfig<Api extends ApiBase<Api>> = {
  baseUrl: string;
  routes?: {
    [ApiId in keyof Api]: ApiId extends `GET ${string}`
      ? OptResourceRouteConfig<Api, ApiId>
      : OptMutationRouteConfig<Api, ApiId>;
  };
  queryClientConfig?: QueryClientConfig;
};

export type OptResourceRouteConfig<
  Api extends ApiBase<Api>,
  ApiId extends `GET ${string}` & keyof Api,
> = {
  hash?: OptResourceHashFn<Api, ApiId>;
  defaultValue?: // If data is a function, it will be called with `params`
    | ((params: Api[ApiId]["params"]) => Api[ApiId]["data"] | undefined)
    // Otherwise, it will be used as is no matter what `params` is
    | Api[ApiId]["data"];
};

export type OptResourceHashFn<
  Api extends ApiBase<Api>,
  ApiId extends `GET ${string}` & keyof Api,
> = (params: Api[ApiId]["params"]) => string;

export type OptMutationRouteConfig<
  Api extends ApiBase<Api>,
  ApiId extends keyof Api,
> = {
  actions?(request: {
    params: Api[ApiId]["params"];
    body: (Api[ApiId] & { body?: unknown })["body"];
    headers: NormalizeHeaders<Api[ApiId]["requestHeaders"]>;
  }): {
    [Res in ResourceId<Api>]: OptAction<Api, Res>;
  }[ResourceId<Api>][];
  onResponse?(arg: {
    data: Api[ApiId]["data"];
    headers: NormalizeHeaders<Api[ApiId]["responseHeaders"]>;
    request: {
      params: Api[ApiId]["params"];
      body: (Api[ApiId] & { body?: unknown })["body"];
      headers: NormalizeHeaders<Api[ApiId]["requestHeaders"]>;
    };
    get: OptGet<Api>;
    set: OptSetWithSentAt<Api>;
  }): void;
};
