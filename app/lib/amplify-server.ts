import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT || "https://nacdrra6kvcgdgfl6vvrvxbs5i.appsync-api.us-east-1.amazonaws.com/graphql",
      region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
      defaultAuthMode: "apiKey",
      apiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY || "da2-hkrvgcesznby3dxfbuedq5gepy",
    },
  },
});

export const client = generateClient();
