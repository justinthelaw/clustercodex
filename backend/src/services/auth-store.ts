import bcrypt from "bcryptjs";

type User = {
  id: string;
  email: string;
  role: "admin" | "user";
  passwordHash: string;
};

const users: User[] = [
  {
    id: "user-admin",
    email: "admin@clustercodex.local",
    role: "admin",
    passwordHash: bcrypt.hashSync("admin123!", 10)
  },
  {
    id: "user-basic",
    email: "user@clustercodex.local",
    role: "user",
    passwordHash: bcrypt.hashSync("user123!", 10)
  }
];

export function verifyUser(email: string, password: string): User | null {
  const user = users.find((candidate) => candidate.email === email);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.passwordHash);
  return ok ? user : null;
}

export function getUserById(id: string): User | null {
  return users.find((candidate) => candidate.id === id) ?? null;
}
