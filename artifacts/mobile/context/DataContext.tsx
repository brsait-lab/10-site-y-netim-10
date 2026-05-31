import {
  addPackage as apiAddPackage,
  createChat as apiCreateChat,
  closeChat as apiCloseChat,
  createPayment as apiCreatePayment,
  getChats,
  getMessages,
  getNotifications,
  getPackages,
  getPayments,
  getUserPayments,
  markNotificationRead as apiMarkRead,
  payDue as apiPayDue,
  sendMessage as apiSendMessage,
  sendNotification as apiSendNotification,
  updatePackageStatus as apiUpdatePackageStatus,
  type NotificationDto,
  type PaymentDto,
  type UserPaymentDto,
  type MessageDto,
  type PackageDto,
  type ChatDto,
} from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

export type NotificationType =
  | "noise"
  | "package"
  | "announcement"
  | "payment"
  | "general"
  | "security"
  | "cargo";

export type AppNotification = NotificationDto & { type: NotificationType };
export type Payment = PaymentDto;
export type UserPayment = UserPaymentDto;
export type Message = MessageDto;
export type Package = PackageDto;
export type Chat = ChatDto;

interface DataContextType {
  notifications: AppNotification[];
  payments: Payment[];
  userPayments: UserPayment[];
  messages: Message[];
  packages: Package[];
  chats: Chat[];
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
  openChat: (title: string, participantIds: string[]) => Promise<Chat>;
  closeMyChat: (chatId: string) => Promise<void>;
  deleteMyChat: (chatId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userPayments, setUserPayments] = useState<UserPayment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [n, p, up, m, pk, ch] = await Promise.all([
        getNotifications(),
        getPayments(),
        getUserPayments(),
        getMessages({}),
        getPackages(),
        getChats(),
      ]);
      setNotifications(n as AppNotification[]);
      setPayments(p as Payment[]);
      setUserPayments(up as UserPayment[]);
      setMessages(m as Message[]);
      setPackages(pk as Package[]);
      setChats(ch as Chat[]);
    } catch {
      // ignore load errors silently
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const refresh = load;

  const getMyNotifications = useCallback(() => {
    if (!user) return [];
    return notifications
      .filter((n) => {
        if (n.siteId !== user.siteId) return false;
        if (n.toUserIds && n.toUserIds.length > 0) return n.toUserIds.includes(user.id);
        if (n.toRoles && n.toRoles.length > 0) return n.toRoles.includes(user.role);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, user]);

  const unreadCount = getMyNotifications().filter(
    (n) => !n.readBy.includes(user?.id ?? ""),
  ).length;

  const sendNotification = async (data: Omit<AppNotification, "id" | "createdAt" | "readBy">) => {
    const newN = await apiSendNotification(data);
    setNotifications((prev) => [...prev, newN as AppNotification]);
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!user) return;
    await apiMarkRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId && !n.readBy.includes(user.id)
          ? { ...n, readBy: [...n.readBy, user.id] }
          : n,
      ),
    );
  };

  const createPayment = async (data: Omit<Payment, "id" | "createdAt">) => {
    const newP = await apiCreatePayment(data);
    setPayments((prev) => [...prev, newP as Payment]);
    await load();
  };

  const payDue = async (userPaymentId: string) => {
    const updated = await apiPayDue(userPaymentId);
    setUserPayments((prev) =>
      prev.map((up) => (up.id === userPaymentId ? (updated as UserPayment) : up)),
    );
  };

  const sendMessage = async (chatId: string, _toId: string, content: string) => {
    if (!user) return;
    const newMsg = await apiSendMessage({ chatId, content });
    setMessages((prev) => [...prev, newMsg as Message]);
  };

  const getChat = useCallback(
    (chatId: string) =>
      messages
        .filter((m) => m.chatId === chatId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const addPackage = async (data: Omit<Package, "id" | "receivedAt">) => {
    const newPkg = await apiAddPackage(data);
    setPackages((prev) => [...prev, newPkg as Package]);
  };

  const updatePackageStatus = async (packageId: string, status: Package["status"]) => {
    const updated = await apiUpdatePackageStatus(packageId, { status });
    setPackages((prev) =>
      prev.map((p) => (p.id === packageId ? (updated as Package) : p)),
    );
  };

  const openChat = async (title: string, participantIds: string[]): Promise<Chat> => {
    const chat = await apiCreateChat({ title, participantIds });
    setChats((prev) => [chat as Chat, ...prev]);
    return chat as Chat;
  };

  const closeMyChat = async (chatId: string) => {
    const updated = await apiCloseChat(chatId);
    setChats((prev) => prev.map((c) => c.id === chatId ? (updated as Chat) : c));
  };

  const deleteMyChat = async (chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  return (
    <DataContext.Provider
      value={{
        notifications,
        payments,
        userPayments,
        messages,
        packages,
        chats,
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
        openChat,
        closeMyChat,
        deleteMyChat,
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
