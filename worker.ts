import handler from 'vinext/server/fetch-handler';

export default {
  fetch(request: Request, env: Record<string, unknown>, context: ExecutionContext) {
    globalThis.__DUBIPOLY_ENV__ = env as typeof globalThis.__DUBIPOLY_ENV__;
    return handler.fetch(request, env, context);
  },
};
