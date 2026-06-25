import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: "/api" });

    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    instance.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          setUser(null);
        }
        return Promise.reject(err);
      }
    );

    return instance;
  }, []);

  const fetchMe = useCallback(async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    setLoading(false);
    return;
  }
  try {
    const { data } = await api.get("/auth/me");
    setUser(data); // data is the user object directly
  } catch (err) {
    localStorage.removeItem("token");
    setUser(null);
  } finally {
    setLoading(false);
  }
}, [api]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    const userData = data.user || data;
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("token", data.token);
    const userData = data.user || data;
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, api, login, logout, register, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
