import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const { filter, limit, nextToken } = ctx.args;
  const scanRequest = {
    operation: "Scan",
    limit: limit || 50,
  };
  if (nextToken) {
    scanRequest.nextToken = nextToken;
  }
  return scanRequest;
}

export function response(ctx) {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken || null,
  };
}
