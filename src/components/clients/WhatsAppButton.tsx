"use client"

import { Button } from "@/components/ui/button"
import { whatsappRenewalUrl } from "@/lib/utils"
import { MessageCircle } from "lucide-react"

interface Props {
  phone: string | null | undefined
  name: string
  membershipEnd: Date | string | null | undefined
  variant?: "default" | "outline" | "ghost"
}

export default function WhatsAppButton({ phone, name, membershipEnd, variant = "outline" }: Props) {
  if (!phone) return null

  const url = whatsappRenewalUrl(phone, name, membershipEnd)

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button variant={variant} size="sm" className="gap-2 text-green-600 border-green-600 hover:bg-green-50">
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </a>
  )
}
