import { util } from "@aws-appsync/utils";
import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  const { filter, limit, nextToken } = ctx.args;
  const scanArgs = { limit: limit || 50 };

  if (nextToken) {
    scanArgs.nextToken = nextToken;
  }

  if (filter) {
    scanArgs.filter = filter;
  }

  return ddb.scan(scanArgs);
}

export function response(ctx) {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken || null,
  };
}
