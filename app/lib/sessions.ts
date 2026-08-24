import { client } from "./amplify-server";
import { createSession as createSessionMutation, updateSession as updateSessionMutation } from "./graphql/mutations";
import { listSessions } from "./graphql/queries";

export interface Session {
  id: string;
  sessionId: string;
  token: string;
  documento: string;
  nombre: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  expiresAt: string;
  phoneNumber: string | null;
  active: boolean;
}

interface CreateSessionInput {
  documento: string;
  nombre: string;
  latitude: number;
  longitude: number;
  sessionId?: string;
}

export async function createNewSession(data: CreateSessionInput): Promise<Session> {
  const token = crypto.randomUUID();
  const sessionId = data.sessionId || crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1h

  const input = {
    sessionId,
    token,
    documento: data.documento,
    nombre: data.nombre,
    latitude: data.latitude,
    longitude: data.longitude,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    active: true,
  };

  const result = await client.graphql({
    query: createSessionMutation,
    variables: { input },
  });

  return (result as { data: { createSession: Session } }).data.createSession;
}

export async function validateSession(token: string): Promise<Session | null> {
  // Scan all sessions and filter by token in application code
  // This approach avoids dependency on AppSync schema filter configuration
  let allItems: Session[] = [];
  let nextToken: string | null = null;

  do {
    const variables: { limit: number; nextToken?: string } = { limit: 50 };
    if (nextToken) variables.nextToken = nextToken;

    const result = await client.graphql({
      query: listSessions,
      variables,
    });

    const data = (result as { data: { listSessions: { items: Session[]; nextToken: string | null } } }).data;
    allItems = allItems.concat(data.listSessions.items);
    nextToken = data.listSessions.nextToken;
  } while (nextToken);

  // Find session by token
  const session = allItems.find((s) => s.token === token);

  if (!session) {
    return null;
  }

  if (!session.active) {
    return null;
  }

  if (new Date(session.expiresAt) < new Date()) {
    return null;
  }

  return session;
}

export async function getSessionBySessionId(sessionId: string): Promise<Session | null> {
  // Scan and filter in application code
  const result = await client.graphql({
    query: listSessions,
    variables: { limit: 50 },
  });

  const items = (result as { data: { listSessions: { items: Session[] } } }).data.listSessions.items;

  return items.find((s) => s.sessionId === sessionId) || null;
}

export async function associatePhoneNumber(sessionId: string, phoneNumber: string): Promise<Session | null> {
  const session = await getSessionBySessionId(sessionId);
  if (!session) return null;

  const result = await client.graphql({
    query: updateSessionMutation,
    variables: {
      input: {
        id: session.id,
        phoneNumber,
      },
    },
  });

  return (result as { data: { updateSession: Session } }).data.updateSession;
}

export async function deactivateSession(sessionId: string): Promise<Session | null> {
  const session = await getSessionBySessionId(sessionId);
  if (!session) return null;

  const result = await client.graphql({
    query: updateSessionMutation,
    variables: {
      input: {
        id: session.id,
        active: false,
      },
    },
  });

  return (result as { data: { updateSession: Session } }).data.updateSession;
}
