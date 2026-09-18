import handler from 'vinext/server/fetch-handler';

const worker = {
  fetch(request: Request, env: Record<string, unknown>, context: ExecutionContext) {
    globalThis.__DUBIPOLY_ENV__ = env as typeof globalThis.__DUBIPOLY_ENV__;
    return handler.fetch(request, env, context);
  },
};

export default worker;
