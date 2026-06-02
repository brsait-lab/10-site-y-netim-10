import { customFetch } from "../custom-fetch";
import type {
  UserPaymentDto, PaymentAuditLogDto, ExpenseDto,
  CreateExpenseRequest, UploadReceiptRequest, ManualPayRequest,
  ApproveRejectRequest, SiteDto,
} from "./api.schemas";

export const uploadReceipt = async (
  upId: string,
  data: UploadReceiptRequest,
  options?: RequestInit,
): Promise<UserPaymentDto> =>
  customFetch<UserPaymentDto>(`/api/user-payments/${upId}/upload-receipt`, {
    method: "PATCH", body: JSON.stringify(data), ...options,
  });

export const approveUserPayment = async (
  upId: string,
  data?: ApproveRejectRequest,
  options?: RequestInit,
): Promise<UserPaymentDto> =>
  customFetch<UserPaymentDto>(`/api/user-payments/${upId}/approve`, {
    method: "PATCH", body: JSON.stringify(data ?? {}), ...options,
  });

export const rejectUserPayment = async (
  upId: string,
  data: ApproveRejectRequest,
  options?: RequestInit,
): Promise<UserPaymentDto> =>
  customFetch<UserPaymentDto>(`/api/user-payments/${upId}/reject`, {
    method: "PATCH", body: JSON.stringify(data), ...options,
  });

export const manualPayUserPayment = async (
  upId: string,
  data: ManualPayRequest,
  options?: RequestInit,
): Promise<UserPaymentDto> =>
  customFetch<UserPaymentDto>(`/api/user-payments/${upId}/manual-pay`, {
    method: "PATCH", body: JSON.stringify(data), ...options,
  });

export const cancelPaymentRequest = async (
  paymentId: string,
  options?: RequestInit,
): Promise<unknown> =>
  customFetch<unknown>(`/api/payments/${paymentId}`, { method: "DELETE", ...options });

export const getPaymentAuditLogs = async (
  params?: { paymentId?: string; userPaymentId?: string },
  options?: RequestInit,
): Promise<PaymentAuditLogDto[]> => {
  const entries = Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][];
  const qs = entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
  return customFetch<PaymentAuditLogDto[]>(`/api/payment-audit-logs${qs}`, options);
};

export const getExpenses = async (
  params?: { year?: number; month?: number; category?: string },
  options?: RequestInit,
): Promise<ExpenseDto[]> => {
  const entries = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)]) as [string, string][];
  const qs = entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
  return customFetch<ExpenseDto[]>(`/api/expenses${qs}`, options);
};

export const createExpense = async (
  data: CreateExpenseRequest,
  options?: RequestInit,
): Promise<ExpenseDto> =>
  customFetch<ExpenseDto>(`/api/expenses`, { method: "POST", body: JSON.stringify(data), ...options });

export const deleteExpense = async (
  id: string,
  options?: RequestInit,
): Promise<ExpenseDto> =>
  customFetch<ExpenseDto>(`/api/expenses/${id}`, { method: "DELETE", ...options });

export const getSite = async (
  id: string,
  options?: RequestInit,
): Promise<SiteDto> =>
  customFetch<SiteDto>(`/api/sites/${id}`, options);
