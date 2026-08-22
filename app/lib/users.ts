export interface User {
  documento: string;
  nombre: string;
}

export const USERS: User[] = [
  { documento: "1023456789", nombre: "Carlos Martínez" },
  { documento: "1098765432", nombre: "María López" },
  { documento: "1045678901", nombre: "Andrés García" },
  { documento: "1067890123", nombre: "Laura Rodríguez" },
];

export function findUserByDocumento(documento: string): User | null {
  return USERS.find((u) => u.documento === documento) || null;
}
