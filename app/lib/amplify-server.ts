import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { APPSYNC_ENDPOINT, APPSYNC_API_KEY, AWS_REGION } from "./constants";

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: APPSYNC_ENDPOINT,
      region: AWS_REGION,
      defaultAuthMode: "apiKey",
      apiKey: APPSYNC_API_KEY,
    },
  },
});

export const client = generateClient();
