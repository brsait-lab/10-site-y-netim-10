import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "resident" | "security" | "merchant";
export type UserStatus = "pending" | "active" | "rejected";

export interface Site {
  id: string;
  name: string;
  address: string;
  adminId: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  siteId: string;
  status: UserStatus;
  phone: string;
  unitNo?: string;
  plates?: string[];
  businessName?: string;
  businessCategory?: string;
  businessDescription?: string;
  businessAddress?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
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

const STORAGE_KEYS = {
  CURRENT_USER: "siteapp_current_user",
  USERS: "siteapp_users",
  SITES: "siteapp_sites",
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSites = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SITES);
    const s: Site[] = raw ? JSON.parse(raw) : [];
    setSites(s);
    return s;
  }, []);

  const refreshSites = useCallback(async () => {
    await loadSites();
  }, [loadSites]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadSites();
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (raw) {
          const storedUser: User = JSON.parse(raw);
          const usersRaw = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
          const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
          const fresh = users.find((u) => u.id === storedUser.id);
          setUser(fresh || storedUser);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadSites]);

  const getUsers = async (): Promise<User[]> => {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  };

  const saveUsers = async (users: User[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  };

  const login = async (email: string, password: string, role: UserRole) => {
    const users = await getUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.role === role
    );
    if (!found) return { success: false, message: "E-posta, şifre veya rol hatalı." };
    if (found.status === "pending") return { success: false, message: "Hesabınız henüz onaylanmadı. Yönetici onayı bekleniyor." };
    if (found.status === "rejected") return { success: false, message: "Hesabınız reddedildi. Lütfen yöneticinizle iletişime geçin." };
    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(found));
    setUser(found);
    return { success: true, message: "Giriş başarılı." };
  };

  const register = async (data: RegisterData) => {
    const users = await getUsers();
    const exists = users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (exists) return { success: false, message: "Bu e-posta adresi zaten kayıtlı." };

    let siteId = data.siteId || "";

    if (data.role === "admin") {
      if (!data.siteName) return { success: false, message: "Site adı gereklidir." };
      const sitesRaw = await AsyncStorage.getItem(STORAGE_KEYS.SITES);
      const existingSites: Site[] = sitesRaw ? JSON.parse(sitesRaw) : [];
      const siteExists = existingSites.find(
        (s) => s.name.toLowerCase() === data.siteName!.toLowerCase()
      );
      if (siteExists) return { success: false, message: "Bu site adı zaten mevcut." };
      const newSite: Site = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: data.siteName,
        address: data.siteAddress || "",
        adminId: "",
        createdAt: new Date().toISOString(),
      };
      const newUser: User = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: data.name,
        email: data.email,
        password: data.password,
        role: "admin",
        siteId: newSite.id,
        status: "active",
        phone: data.phone,
        createdAt: new Date().toISOString(),
      };
      newSite.adminId = newUser.id;
      existingSites.push(newSite);
      await AsyncStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(existingSites));
      setSites(existingSites);
      users.push(newUser);
      await saveUsers(users);
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
      setUser(newUser);
      return { success: true, message: "Hesap oluşturuldu." };
    }

    // Merchants don't need a site — they register globally and are found by location
    if (data.role !== "merchant" && !siteId) {
      return { success: false, message: "Lütfen bir site seçin." };
    }

    const newUser: User = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      siteId: siteId || "global",
      status: data.role === "security" ? "active" : data.role === "merchant" ? "active" : "pending",
      phone: data.phone,
      unitNo: data.unitNo,
      plates: data.plates,
      businessName: data.businessName,
      businessCategory: data.businessCategory,
      businessDescription: data.businessDescription,
      businessAddress: data.businessAddress,
      latitude: data.latitude,
      longitude: data.longitude,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await saveUsers(users);

    if (newUser.status === "active") {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
      setUser(newUser);
      return { success: true, message: "Kayıt başarılı." };
    }

    return { success: true, message: "Kayıt talebiniz alındı. Yönetici onayı bekleniyor." };
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setUser(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...updates };
      await saveUsers(users);
      const updated = users[idx];
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
      setUser(updated);
    }
  };

  const getAllUsers = async () => getUsers();

  const approveUser = async (userId: string) => {
    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      users[idx].status = "active";
      await saveUsers(users);
    }
  };

  const rejectUser = async (userId: string) => {
    const users = await getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      users[idx].status = "rejected";
      await saveUsers(users);
    }
  };

  const getSiteUsers = async (siteId: string) => {
    const users = await getUsers();
    return users.filter((u) => u.siteId === siteId);
  };

  const getAllMerchants = async () => {
    const users = await getUsers();
    return users.filter((u) => u.role === "merchant");
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
