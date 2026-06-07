import {
  approveUser as apiApproveUser,
  customFetch,
  getMe,
  getSites,
  getUsers,
  login as apiLogin,
  register as apiRegister,
  rejectUser as apiRejectUser,
  setForceLogoutHandler,
  setRefreshTokenHandler,
  updateUser as apiUpdateUser,
  type UserDto,
  type SiteDto,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import * as tokenStore from "@/lib/tokenStore";

export type UserRole = "admin" | "resident" | "security" | "merchant";
export type UserStatus = "pending" | "active" | "rejected";

export type User = UserDto & {
  role: UserRole;
  status: UserStatus;
  block?: string;
  tower?: string;
  villaNo?: string;
  floor?: string;
  officeNo?: string;
};

export type Site = SiteDto & {
  settlementType?: string;
};

export interface SiteDetail {
  id: string;
  name: string;
  address: string;
  adminId: string;
  settlementType: string;
  joinCode?: string;
  bankName?: string;
  accountHolder?: string;
  iban?: string;
  createdAt: string;
}

export interface SiteLookupResult {
  id: string;
  name: string;
  address: string;
  settlementType: string;
}

interface AuthContextType {
  user: User | null;
  sites: Site[];
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  getAllUsers: () => Promise<User[]>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  getSiteUsers: (siteId: string) => Promise<User[]>;
  getAllMerchants: () => Promise<User[]>;
  refreshSites: () => Promise<void>;
  lookupSiteByJoinCode: (code: string) => Promise<SiteLookupResult | null>;
  getSiteDetails: (siteId: string) => Promise<SiteDetail | null>;
  updateSite: (
    siteId: string,
    data: Partial<Pick<SiteDetail, "name" | "address" | "settlementType" | "bankName" | "accountHolder" | "iban">>,
  ) => Promise<SiteDetail | null>;
  softDeleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  transferAdmin: (targetUserId: string) => Promise<{ success: boolean; message: string }>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  siteName?: string;
  siteAddress?: string;
  settlementType?: string;
  joinCode?: string;
  unitNo?: string;
  block?: string;
  tower?: string;
  villaNo?: string;
  floor?: string;
  officeNo?: string;
  plates?: string[];
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  businessAddress?: string;
  latitude?: number;
  longitude?: number;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Keep a stable ref to setUser so the force-logout handler (registered once)
  // always calls the latest setter without needing to re-register.
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  // ── Wire refresh + force-logout handlers ──────────────────────────────────
  useEffect(() => {
    // Refresh handler: called by customFetch on 401.
    // Reads stored RT → POST /auth/refresh → stores new tokens → returns new AT.
    setRefreshTokenHandler(async () => {
      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return null;

        const result = await customFetch<{
          accessToken: string;
          refreshToken: string;
        }>("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });

        await tokenStore.setAccessToken(result.accessToken);
        await tokenStore.setRefreshToken(result.refreshToken);
        return result.accessToken;
      } catch {
        return null;
      }
    });

    // Force-logout handler: called when refresh itself fails (expired / revoked).
    setForceLogoutHandler(() => {
      tokenStore.clearTokens().catch(() => {});
      setUserRef.current(null);
      router.replace("/(auth)/login" as never);
    });

    return () => {
      setRefreshTokenHandler(null);
      setForceLogoutHandler(null);
    };
  }, []);

  // ── App init: restore session from SecureStore ────────────────────────────
  const loadSites = useCallback(async () => {
    try {
      const data = await getSites();
      setSites(data as Site[]);
      return data as Site[];
    } catch {
      return [] as Site[];
    }
  }, []);

  const refreshSites = useCallback(async () => { await loadSites(); }, [loadSites]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadSites();
        const token = await tokenStore.getAccessToken();
        if (token) {
          const me = await getMe();
          setUser(me as User);
        }
      } catch {
        await tokenStore.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadSites]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = async (email: string, password: string, role: UserRole) => {
    try {
      const result = await apiLogin({ email, password, role });
      // The server returns { token, accessToken, refreshToken } but the generated
      // type only knows about `token`.  Cast through unknown to access extras.
      const loginExtra = result as unknown as { accessToken?: string; refreshToken?: string };
      await tokenStore.setAccessToken(loginExtra.accessToken ?? result.token);
      if (loginExtra.refreshToken) {
        await tokenStore.setRefreshToken(loginExtra.refreshToken);
      }
      setUser(result.user as User);
      return { success: true, message: "Giriş başarılı." };
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err as { message?: string })?.message ??
        "Giriş başarısız.";
      return { success: false, message: msg };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiRegister(data as any);
      if (result.success && result.user) {
        const regExtra = result as unknown as { accessToken?: string; refreshToken?: string };
        const accessToken = regExtra.accessToken ?? result.token;
        const refreshToken = regExtra.refreshToken;

        if (accessToken) await tokenStore.setAccessToken(accessToken);
        if (refreshToken) await tokenStore.setRefreshToken(refreshToken);
        setUser(result.user as User);
      }
      return { success: result.success, message: result.message };
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err as { message?: string })?.message ??
        "Kayıt başarısız.";
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (refreshToken) {
        // Best-effort: tell the server to revoke this refresh token.
        await customFetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
      }
    } finally {
      await tokenStore.clearTokens();
      setUser(null);
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await apiUpdateUser(user.id, updates as any);
      setUser(updated as User);
    } catch { /* silently fail */ }
  };

  const getAllUsers = async (): Promise<User[]> => {
    if (!user) return [];
    try {
      return (await getUsers({ siteId: user.siteId })) as User[];
    } catch { return []; }
  };

  const approveUser = async (userId: string) => { await apiApproveUser(userId); };
  const rejectUser  = async (userId: string) => { await apiRejectUser(userId); };

  const getSiteUsers = async (siteId: string): Promise<User[]> => {
    try { return (await getUsers({ siteId })) as User[]; }
    catch { return []; }
  };

  const getAllMerchants = async (): Promise<User[]> => {
    try {
      const res = await customFetch<User[]>("/api/users?role=merchant");
      return Array.isArray(res) ? res : [];
    } catch { return []; }
  };

  const lookupSiteByJoinCode = async (code: string): Promise<SiteLookupResult | null> => {
    try {
      return await customFetch<SiteLookupResult>(
        `/api/sites/lookup?joinCode=${encodeURIComponent(code.toUpperCase().trim())}`,
      );
    } catch { return null; }
  };

  const getSiteDetails = async (siteId: string): Promise<SiteDetail | null> => {
    try {
      return await customFetch<SiteDetail>(`/api/sites/${siteId}`);
    } catch { return null; }
  };

  const updateSite = async (
    siteId: string,
    data: Partial<Pick<SiteDetail, "name" | "address" | "settlementType" | "bankName" | "accountHolder" | "iban">>,
  ): Promise<SiteDetail | null> => {
    try {
      return await customFetch<SiteDetail>(`/api/sites/${siteId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    } catch { return null; }
  };

  const softDeleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await customFetch<{ success: boolean }>(`/api/users/${userId}`, { method: "DELETE" });
      return result.success
        ? { success: true, message: "Kullanıcı silindi." }
        : { success: false, message: "Silinemedi." };
    } catch (err: unknown) {
      return {
        success: false,
        message:
          (err as { data?: { message?: string } })?.data?.message ??
          (err as { message?: string })?.message ??
          "Silme işlemi başarısız.",
      };
    }
  };

  const transferAdmin = async (targetUserId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await customFetch<{ success: boolean; message: string }>(
        `/api/users/${targetUserId}/transfer-admin`,
        { method: "POST" },
      );
      if (result.success && user) setUser({ ...user, role: "resident" });
      return { success: result.success, message: result.message };
    } catch (err: unknown) {
      return {
        success: false,
        message:
          (err as { data?: { message?: string } })?.data?.message ??
          (err as { message?: string })?.message ??
          "Devir işlemi başarısız.",
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user, sites, isLoading,
        login, register, logout, updateUser,
        getAllUsers, approveUser, rejectUser,
        getSiteUsers, getAllMerchants, refreshSites,
        lookupSiteByJoinCode, getSiteDetails, updateSite,
        softDeleteUser, transferAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
