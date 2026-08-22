export interface User {
  documento: string;
  nombre: string;
  password: string;
}

export const USERS: User[] = [
  { documento: "1023456789", nombre: "Carlos Martínez", password: "1234567890" },
  { documento: "1098765432", nombre: "María López", password: "1234567890" },
  { documento: "1045678901", nombre: "Andrés García", password: "1234567890" },
  { documento: "1067890123", nombre: "Laura Rodríguez", password: "1234567890" },
];

export function findUserByDocumento(documento: string): User | null {
  return USERS.find((u) => u.documento === documento) || null;
}

export function validateCredentials(documento: string, password: string): User | null {
  const user = findUserByDocumento(documento);
  if (!user) return null;
  if (user.password !== password) return null;
  return user;
}
