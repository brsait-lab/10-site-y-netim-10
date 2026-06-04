import React, { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import type { DashboardStatsDto } from "./DataContext";

interface SocketContextType {
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  onNewMessage: (handler: (msg: unknown) => void) => () => void;
  onDashboardStatsUpdated: (handler: (stats: DashboardStatsDto) => void) => () => void;
  onSiteNotification: (handler: (payload: unknown) => void) => () => void;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  joinChat: () => {},
  leaveChat: () => {},
  onNewMessage: () => () => {},
  onDashboardStatsUpdated: () => () => {},
  onSiteNotification: () => () => {},
  connected: false,
});

const domain = process.env.EXPO_PUBLIC_DOMAIN;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);
  const [connected, setConnected] = React.useState(false);

  useEffect(() => {
    if (!user || !domain) return;

    let socket: Socket | null = null;

    async function connect() {
      const token = await AsyncStorage.getItem("siteapp_token");
      if (!token) return;

      socket = io(`https://${domain}`, {
        path: "/api/socket.io",
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socket.on("connect", () => {
        connectedRef.current = true;
        setConnected(true);
      });

      socket.on("disconnect", () => {
        connectedRef.current = false;
        setConnected(false);
      });

      socket.on("connect_error", (_err: Error) => {
        connectedRef.current = false;
        setConnected(false);
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
      setConnected(false);
    };
  }, [user]);

  const joinChat = useCallback((chatId: string) => {
    socketRef.current?.emit("join_chat", chatId);
  }, []);

  const leaveChat = useCallback((chatId: string) => {
    socketRef.current?.emit("leave_chat", chatId);
  }, []);

  const onNewMessage = useCallback((handler: (msg: unknown) => void) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on("new_message", handler);
    return () => { s.off("new_message", handler); };
  }, []);

  const onDashboardStatsUpdated = useCallback((handler: (stats: DashboardStatsDto) => void) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on("dashboard_stats_updated", handler);
    return () => { s.off("dashboard_stats_updated", handler); };
  }, []);

  const onSiteNotification = useCallback((handler: (payload: unknown) => void) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on("site_notification", handler);
    return () => { s.off("site_notification", handler); };
  }, []);

  return (
    <SocketContext.Provider value={{ joinChat, leaveChat, onNewMessage, onDashboardStatsUpdated, onSiteNotification, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
