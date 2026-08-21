import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id, ...values } = ctx.args.input;
  return ddb.update({
    key: { id },
    update: values,
  });
}

export function response(ctx) {
  return ctx.result;
}
