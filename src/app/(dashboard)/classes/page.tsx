import { prisma } from "@/lib/prisma"
import Header from "@/components/layout/Header"
import ClassesClient from "./ClassesClient"

export default async function ClassesPage() {
  const classes = await prisma.class.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  })

  return (
    <>
      <Header title="Clases" />
      <ClassesClient initialClasses={classes} />
    </>
  )
}
