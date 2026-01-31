import axios from "axios";
import { getAuth } from "./auth";

const baseURL = (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:3001";

export const api = axios.create({
  baseURL
});

api.interceptors.request.use((config) => {
  const auth = getAuth();
  if (auth?.token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});
