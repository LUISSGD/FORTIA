import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `S/ ${amount.toFixed(2)}`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return format(new Date(date), "dd/MM/yyyy", { locale: es })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es })
}

export function daysUntilExpiry(membershipEnd: Date | string | null | undefined): number | null {
  if (!membershipEnd) return null
  return differenceInDays(new Date(membershipEnd), new Date())
}

export function getRenewalStatus(days: number | null): "active" | "warning" | "urgent" | "expired" | "none" {
  if (days === null) return "none"
  if (days < 0) return "expired"
  if (days <= 5) return "urgent"
  if (days <= 10) return "warning"
  return "active"
}

export function whatsappRenewalUrl(
  phone: string | null | undefined,
  name: string,
  expiryDate: Date | string | null | undefined
): string {
  const cleanPhone = phone?.replace(/\D/g, "") ?? ""
  const fullPhone = cleanPhone.startsWith("51") ? cleanPhone : `51${cleanPhone}`
  const fechaVencimiento = expiryDate ? formatDate(expiryDate) : "próximamente"
  const message = encodeURIComponent(
    `Hola ${name}, tu membresía FORTIA vence el ${fechaVencimiento}. ¡Renueva y sigue entrenando! 💪`
  )
  return `https://wa.me/${fullPhone}?text=${message}`
}

export const INCOME_CATEGORIES: Record<string, string> = {
  MEMBERSHIP: "Membresía",
  PRODUCT_SALE: "Venta de producto",
  DAY_PASS: "Pase diario",
  PERSONAL_TRAINING: "Entrenamiento personal",
  OTHER: "Otro",
}

export const EXPENSE_CATEGORIES: Record<string, string> = {
  RENT: "Alquiler",
  ELECTRICITY: "Electricidad",
  WATER: "Agua",
  INTERNET: "Internet",
  EQUIPMENT: "Equipamiento",
  SUPPLIER: "Proveedor",
  SALARY: "Salario",
  MAINTENANCE: "Mantenimiento",
  MARKETING: "Marketing",
  OTHER: "Otro",
}

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
  OTHER: "Otro",
}

export const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
