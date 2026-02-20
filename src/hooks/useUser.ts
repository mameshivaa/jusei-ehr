"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "PRACTITIONER" | "RECEPTION";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
};

/**
 * クライアントサイドでユーザー情報を取得するフック
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log("[useUser] Loading user...");
        // まずサーバーからユーザー情報を取得を試みる
        // DEV_BYPASS_AUTHの場合はダミーユーザーが返される
        const response = await fetch("/api/auth/user");
        console.log("[useUser] Response status:", response.status);
        if (response.ok) {
          const userData = await response.json();
          console.log("[useUser] User loaded:", userData);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("[useUser] Error loading user:", error);
        setUser(null);
      } finally {
        setLoading(false);
        console.log("[useUser] Loading complete");
      }
    };

    loadUser();
  }, []);

  return { user, loading };
}
