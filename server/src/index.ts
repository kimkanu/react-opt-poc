import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

let version = 1;

const app = new Elysia()
  .use(cors())
  .get("/users/:userId/version", () => {
    return { version };
  })
  .post("/users/:userId/version/increase", async (ctx) => {
    if (ctx.headers["x-user-credential"] !== "correct") {
      ctx.set.status = 401;
      return;
    }

    version += (await ctx.request.json()).increaseBy;
    return { version };
  })
  .listen(5678);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
