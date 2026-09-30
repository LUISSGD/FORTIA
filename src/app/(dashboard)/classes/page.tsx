import { prisma } from "@/lib/prisma"
import ClassesClient from "./ClassesClient"

export default async function ClassesPage() {
  const classes = await prisma.class.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  })

  return (
    <>
      <ClassesClient initialClasses={classes} />
    </>
  )
}
