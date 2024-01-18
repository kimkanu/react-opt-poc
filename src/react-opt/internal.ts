import type { QueryClient } from "@tanstack/react-query";
import { FetchError } from "./error";
import type { Method, OptConfig, OptGet } from "./types";

/**
 * @internal
 *
 * Base headers type
 */
export type HeadersBase = Record<string, string | undefined>;

/**
 * @internal
 *
 * Restrict the type `Api` to be a valid API type definition
 *
 * 1. Each key of `Api` must be a space-separated string of HTTP method and
 *    path, where path can contain path parameters starting with `:`.
 * 2. For resource APIs (i.e., `GET` APIs), the value type of it must be
 *    an object containing the following fields:
 *    - `params`: an object containing path parameters
 *
 */
export type ApiBase<Api> = {
  [ApiId in keyof Api]: ApiId extends `${infer M extends
    Method} ${infer P extends string}`
    ? NormalizeOptionalFields<{
        // request related fields
        params: IsNever<ExtractPathParams<P>> extends true
          ? Record<string, string | number | undefined | null> | undefined
          : Record<ExtractPathParams<P>, string | number | undefined | null>;
        body: M extends "GET" ? undefined : unknown | undefined;
        requestHeaders?: HeadersBase;

        // response related fields
        data: M extends "GET" ? unknown : unknown | undefined;
        responseHeaders?: HeadersBase;
      }>
    : never;
};

/**
 * @internal
 *
 * Extract resource routes from API type
 */
export type ResourceId<Api extends ApiBase<Api>> = keyof {
  [K in keyof Api as K extends `GET ${infer P}` ? P : never]: unknown;
} &
  string;

/**
 * @internal
 *
 * Extract mutation routes from API type
 */
export type MutateId<Api extends ApiBase<Api>> = Exclude<
  keyof Api,
  `GET ${string}`
>;

/**
 * @internal
 *
 * Type of the context object passed to `OptContext.Provider`
 */
export type OptClient<Api extends ApiBase<Api>> = {
  config: OptConfig<Api>;
  queryClient: QueryClient;

  cacheStore: OptCacheStore<Api>;
  actionStore: OptActionStore<Api>;
  optStore: OptOptStore<Api>;
};

/**
 * @internal
 */
export type OptCacheStore<Api extends ApiBase<Api>> = {
  [Res in ResourceId<Api>]?: Record<
    string,
    | {
        data: Api[`GET ${Res}` & keyof Api]["data"];
        sentAt: number;
      }
    | undefined
  >;
};

/**
 * @internal
 */
export type OptActionStore<Api extends ApiBase<Api>> = {
  [Res in ResourceId<Api>]?: Record<
    string,
    | {
        fn: (
          prev: Api[`GET ${Res}` & keyof Api]["data"] | undefined,
          get: OptGet<Api>,
        ) => Api[`GET ${Res}` & keyof Api]["data"] | undefined;
        createdAt: number;
      }[]
    | undefined
  >;
};

/**
 * @internal
 */
export type OptOptStore<Api extends ApiBase<Api>> = {
  [Res in ResourceId<Api>]?: Record<
    string,
    Api[`GET ${Res}` & keyof Api]["data"] | undefined
  >;
};

/**
 * @internal
 *
 * Internal fetch function
 */
export async function internalFetch<D, H>({
  baseUrl,
  method,
  path,
  params,
  headers,
  body,
}: {
  baseUrl: string;
  method: Method;
  path: string;
  params?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string | undefined>;
  body?: unknown;
}) {
  let url = baseUrl + path;
  {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null) continue;
      const regex = new RegExp(`:${key}(?=/|$)`, "g");
      if (regex.test(url)) {
        url = url.replace(regex, (value as string | number).toString());
      } else {
        searchParams.append(key, (value as string | number).toString());
      }
    }
    const stringifiedSearchParams = searchParams.toString();
    url += `${stringifiedSearchParams ? "?" : ""}${stringifiedSearchParams}`;
  }

  const isBodyJson =
    body === undefined
      ? true
      : typeof body === "object" &&
        (body === null || body.constructor === Object);
  const isBodyText = body === undefined ? false : typeof body === "string";
  const isBodyFormData = body === undefined ? false : body instanceof FormData;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": isBodyJson
        ? "application/json"
        : isBodyText
          ? "text/plain"
          : isBodyFormData
            ? "multipart/form-data"
            : "application/octet-stream",
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : isBodyJson
          ? JSON.stringify(body)
          : (body as BodyInit | null | undefined),
  });

  if (!response.ok) throw new FetchError(response);

  const contentType = response.headers.get("Content-Type");
  const headersObject = Object.fromEntries(response.headers.entries()) as H;

  const data = (
    contentType?.includes("json")
      ? await response.json()
      : contentType?.startsWith("text/")
        ? await response.text()
        : await response.arrayBuffer()
  ) as D;

  return {
    data,
    headers: headersObject,
    response,
  };
}

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  P,
>() => P extends Y ? 1 : 2
  ? true
  : false;

export type ExtractPathParams<P extends string> =
  P extends `${infer _}/:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : P extends `${infer _}/:${infer Param}`
      ? Param
      : never;

export type IsNever<T> = [T] extends [never] ? true : false;

export type Prettify<T extends Record<string | number | symbol, unknown>> = {
  [K in keyof T]: T[K];
} & {};

export type NormalizeOptionalFields<
  T extends Record<string | number | symbol, unknown>,
> = Prettify<
  {
    // required fields
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
  } & {
    // optional fields
    [K in keyof T as undefined extends T[K]
      ? // opt out undefined fields
        Equal<T[K], undefined> extends true
        ? never
        : K
      : never]?: T[K];
  }
>;
