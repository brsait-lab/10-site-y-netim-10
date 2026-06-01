import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  approveUser as apiApproveUser,
  customFetch,
  getMe,
  getSites,
  getUsers,
  login as apiLogin,
  register as apiRegister,
  rejectUser as apiRejectUser,
  updateUser as apiUpdateUser,
  type UserDto,
  type SiteDto,
} from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
  // Admin only
  siteName?: string;
  siteAddress?: string;
  settlementType?: string;
  // Resident/Security: join via code
  joinCode?: string;
  // Residential fields
  unitNo?: string;
  block?: string;
  tower?: string;
  villaNo?: string;
  floor?: string;
  officeNo?: string;
  plates?: string[];
  // Merchant fields
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  businessAddress?: string;
  latitude?: number;
  longitude?: number;
}

const TOKEN_KEY = "siteapp_token";
const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (token) {
          const me = await getMe();
          setUser(me as User);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadSites]);

  const login = async (email: string, password: string, role: UserRole) => {
    try {
      const result = await apiLogin({ email, password, role });
      await AsyncStorage.setItem(TOKEN_KEY, result.token);
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
      if (result.success && result.token && result.user) {
        await AsyncStorage.setItem(TOKEN_KEY, result.token);
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
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
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
      const all = (await getUsers({ siteId: user?.siteId ?? "" })) as User[];
      return all.filter((u) => u.role === "merchant");
    } catch { return []; }
  };

  // ── NEW: lookup site by join code (public endpoint) ───────────────────────
  const lookupSiteByJoinCode = async (code: string): Promise<SiteLookupResult | null> => {
    try {
      return await customFetch<SiteLookupResult>(
        `/api/sites/lookup?joinCode=${encodeURIComponent(code.toUpperCase().trim())}`,
      );
    } catch { return null; }
  };

  // ── NEW: full site details including joinCode + bank (admin only) ─────────
  const getSiteDetails = async (siteId: string): Promise<SiteDetail | null> => {
    try {
      return await customFetch<SiteDetail>(`/api/sites/${siteId}`);
    } catch { return null; }
  };

  // ── NEW: update site settings ─────────────────────────────────────────────
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

  // ── NEW: soft-delete a user (admin only) ──────────────────────────────────
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

  // ── NEW: transfer admin to another user ───────────────────────────────────
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
