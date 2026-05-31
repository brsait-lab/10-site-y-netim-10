import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  approveUser as apiApproveUser,
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
};

export type Site = SiteDto;

interface AuthContextType {
  user: User | null;
  sites: Site[];
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  getAllUsers: () => Promise<User[]>;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  getSiteUsers: (siteId: string) => Promise<User[]>;
  getAllMerchants: () => Promise<User[]>;
  refreshSites: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  siteId?: string;
  siteName?: string;
  siteAddress?: string;
  unitNo?: string;
  plates?: string[];
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

  const refreshSites = useCallback(async () => {
    await loadSites();
  }, [loadSites]);

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
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ??
        (err as { message?: string })?.message ??
        "Giriş başarısız.";
      return { success: false, message: msg };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const result = await apiRegister(data);
      if (result.success && result.token && result.user) {
        await AsyncStorage.setItem(TOKEN_KEY, result.token);
        setUser(result.user as User);
      }
      return { success: result.success, message: result.message };
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ??
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
      const updated = await apiUpdateUser(user.id, updates);
      setUser(updated as User);
      await AsyncStorage.setItem(TOKEN_KEY, await AsyncStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      // silently fail
    }
  };

  const getAllUsers = async (): Promise<User[]> => {
    if (!user) return [];
    try {
      const users = await getUsers({ siteId: user.siteId });
      return users as User[];
    } catch {
      return [];
    }
  };

  const approveUser = async (userId: string) => {
    await apiApproveUser(userId);
  };

  const rejectUser = async (userId: string) => {
    await apiRejectUser(userId);
  };

  const getSiteUsers = async (siteId: string): Promise<User[]> => {
    try {
      const users = await getUsers({ siteId });
      return users as User[];
    } catch {
      return [];
    }
  };

  const getAllMerchants = async (): Promise<User[]> => {
    try {
      const allUsers = await getUsers({ siteId: user?.siteId ?? "" });
      return (allUsers as User[]).filter((u) => u.role === "merchant");
    } catch {
      return [];
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sites,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        getAllUsers,
        approveUser,
        rejectUser,
        getSiteUsers,
        getAllMerchants,
        refreshSites,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
