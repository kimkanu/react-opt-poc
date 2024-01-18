import { createOptClient } from "./react-opt";

export type MyApi = {
  "GET /users/:userId/version": {
    params: {
      userId: string;
    };
    data: {
      version: number;
    };
  };
  "POST /users/:userId/version/increase": {
    requestHeaders: {
      "X-User-Credential": string;
    };
    params: {
      userId: string;
    };
    body: {
      increaseBy: number;
    };
    data: {
      version: number;
    };
  };
};

export const optClient = createOptClient<MyApi>({
  baseUrl: "http://localhost:5678",
  routes: {
    "GET /users/:userId/version": {
      defaultValue: { version: 1 },
    },
    "POST /users/:userId/version/increase": {
      actions({ params, body }) {
        return [
          {
            resourceId: "/users/:userId/version",
            params,
            fn(prev) {
              return { version: prev.version + body.increaseBy };
            },
          },
        ];
      },
      onResponse({ data, request: { params }, set }) {
        console.log("onResponse", data, params);
        set("/users/:userId/version", params, data);
      },
    },
  },
});
