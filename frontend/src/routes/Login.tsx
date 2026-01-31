import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setAuth } from "../lib/auth";
import ErrorBanner from "../components/ErrorBanner";

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
  };
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password
      });
      setAuth({ token: response.data.accessToken, user: response.data.user });
      setLoading(false);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "420px", margin: "40px auto" }}>
      <h2>Sign in</h2>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
