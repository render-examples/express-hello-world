export const validRoles = ["CLIENT", "WORKER", "ADMIN"];

export const isAValidRole = (role: string) => {
  return validRoles.includes(role);
};

export const isAdmin = (role: string) => {
  return role === validRoles[2];
};