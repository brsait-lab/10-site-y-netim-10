import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

export type NotificationType = "noise" | "package" | "announcement" | "payment" | "general" | "security" | "cargo";
export type NotificationTarget = "all" | "role" | "user";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  fromUserId: string;
  fromName: string;
  toRoles?: string[];
  toUserIds?: string[];
  siteId: string;
  createdAt: string;
  readBy: string[];
}

export interface Payment {
  id: string;
  siteId: string;
  title: string;
  amount: number;
  dueDate: string;
  type: "aidat" | "gider";
  description?: string;
  createdAt: string;
}

export interface UserPayment {
  id: string;
  paymentId: string;
  userId: string;
  siteId: string;
  status: "pending" | "paid";
  paidAt?: string;
}

export interface Message {
  id: string;
  chatId: string;
  fromId: string;
  fromName: string;
  content: string;
  createdAt: string;
}

export interface Package {
  id: string;
  siteId: string;
  recipientUserId: string;
  recipientName: string;
  senderInfo: string;
  description: string;
  status: "received" | "notified" | "delivered";
  receivedAt: string;
  deliveredAt?: string;
}

interface DataContextType {
  notifications: AppNotification[];
  payments: Payment[];
  userPayments: UserPayment[];
  messages: Message[];
  packages: Package[];
  unreadCount: number;
  sendNotification: (data: Omit<AppNotification, "id" | "createdAt" | "readBy">) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  createPayment: (data: Omit<Payment, "id" | "createdAt">) => Promise<void>;
  payDue: (userPaymentId: string) => Promise<void>;
  sendMessage: (chatId: string, toId: string, content: string) => Promise<void>;
  getChat: (chatId: string) => Message[];
  addPackage: (data: Omit<Package, "id" | "receivedAt">) => Promise<void>;
  updatePackageStatus: (packageId: string, status: Package["status"]) => Promise<void>;
  getMyNotifications: () => AppNotification[];
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

const KEYS = {
  NOTIFICATIONS: "siteapp_notifications",
  PAYMENTS: "siteapp_payments",
  USER_PAYMENTS: "siteapp_user_payments",
  MESSAGES: "siteapp_messages",
  PACKAGES: "siteapp_packages",
};

function maskSensitiveInfo(text: string): string {
  return text
    .replace(/(\+?90|0)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g, "***TELEFON***")
    .replace(/\b\d{10,11}\b/g, "***GİZLİ***")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***E-POSTA***");
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userPayments, setUserPayments] = useState<UserPayment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  const load = useCallback(async () => {
    const [n, p, up, m, pk] = await Promise.all([
      AsyncStorage.getItem(KEYS.NOTIFICATIONS),
      AsyncStorage.getItem(KEYS.PAYMENTS),
      AsyncStorage.getItem(KEYS.USER_PAYMENTS),
      AsyncStorage.getItem(KEYS.MESSAGES),
      AsyncStorage.getItem(KEYS.PACKAGES),
    ]);
    setNotifications(n ? JSON.parse(n) : []);
    setPayments(p ? JSON.parse(p) : []);
    setUserPayments(up ? JSON.parse(up) : []);
    setMessages(m ? JSON.parse(m) : []);
    setPackages(pk ? JSON.parse(pk) : []);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const refresh = load;

  const getMyNotifications = useCallback(() => {
    if (!user) return [];
    return notifications.filter((n) => {
      if (n.siteId !== user.siteId) return false;
      if (n.toUserIds && n.toUserIds.length > 0) {
        return n.toUserIds.includes(user.id);
      }
      if (n.toRoles && n.toRoles.length > 0) {
        return n.toRoles.includes(user.role);
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user]);

  const unreadCount = getMyNotifications().filter(
    (n) => !n.readBy.includes(user?.id || "")
  ).length;

  const sendNotification = async (data: Omit<AppNotification, "id" | "createdAt" | "readBy">) => {
    const newN: AppNotification = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    const updated = [...notifications, newN];
    setNotifications(updated);
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!user) return;
    const updated = notifications.map((n) =>
      n.id === notificationId && !n.readBy.includes(user.id)
        ? { ...n, readBy: [...n.readBy, user.id] }
        : n
    );
    setNotifications(updated);
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
  };

  const createPayment = async (data: Omit<Payment, "id" | "createdAt">) => {
    const newP: Payment = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updatedP = [...payments, newP];
    setPayments(updatedP);
    await AsyncStorage.setItem(KEYS.PAYMENTS, JSON.stringify(updatedP));

    const raw = await AsyncStorage.getItem("siteapp_users");
    const allUsers = raw ? JSON.parse(raw) : [];
    const siteResidents = allUsers.filter(
      (u: { role: string; siteId: string; status: string }) =>
        u.siteId === data.siteId && u.role === "resident" && u.status === "active"
    );

    const newUPs: UserPayment[] = siteResidents.map((u: { id: string }) => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9) + u.id,
      paymentId: newP.id,
      userId: u.id,
      siteId: data.siteId,
      status: "pending" as const,
    }));

    const updatedUP = [...userPayments, ...newUPs];
    setUserPayments(updatedUP);
    await AsyncStorage.setItem(KEYS.USER_PAYMENTS, JSON.stringify(updatedUP));
  };

  const payDue = async (userPaymentId: string) => {
    const updated = userPayments.map((up) =>
      up.id === userPaymentId ? { ...up, status: "paid" as const, paidAt: new Date().toISOString() } : up
    );
    setUserPayments(updated);
    await AsyncStorage.setItem(KEYS.USER_PAYMENTS, JSON.stringify(updated));
  };

  const sendMessage = async (chatId: string, toId: string, content: string) => {
    if (!user) return;
    const masked = maskSensitiveInfo(content);
    const newMsg: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      chatId,
      fromId: user.id,
      fromName: user.name,
      content: masked,
      createdAt: new Date().toISOString(),
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(updated));
  };

  const getChat = useCallback(
    (chatId: string) =>
      messages
        .filter((m) => m.chatId === chatId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  const addPackage = async (data: Omit<Package, "id" | "receivedAt">) => {
    const newPkg: Package = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      receivedAt: new Date().toISOString(),
    };
    const updated = [...packages, newPkg];
    setPackages(updated);
    await AsyncStorage.setItem(KEYS.PACKAGES, JSON.stringify(updated));
  };

  const updatePackageStatus = async (packageId: string, status: Package["status"]) => {
    const updated = packages.map((p) =>
      p.id === packageId
        ? { ...p, status, deliveredAt: status === "delivered" ? new Date().toISOString() : p.deliveredAt }
        : p
    );
    setPackages(updated);
    await AsyncStorage.setItem(KEYS.PACKAGES, JSON.stringify(updated));
  };

  return (
    <DataContext.Provider
      value={{
        notifications,
        payments,
        userPayments,
        messages,
        packages,
        unreadCount,
        sendNotification,
        markNotificationRead,
        createPayment,
        payDue,
        sendMessage,
        getChat,
        addPackage,
        updatePackageStatus,
        getMyNotifications,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
