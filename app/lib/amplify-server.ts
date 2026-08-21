import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: process.env.APPSYNC_ENDPOINT || "https://nacdrra6kvcgdgfl6vvrvxbs5i.appsync-api.us-east-1.amazonaws.com/graphql",
      region: process.env.AWS_REGION || "us-east-1",
      defaultAuthMode: "apiKey",
      apiKey: process.env.APPSYNC_API_KEY || "da2-hkrvgcesznby3dxfbuedq5gepy",
    },
  },
});

export const client = generateClient();
