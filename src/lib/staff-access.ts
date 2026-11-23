// Accesos del staff (rol USER): reglas puras, compartidas por el proxy, los menús y la pantalla de Usuarios.
// Todo lo que no esté en un módulo activo queda cerrado (páginas y datos). Cobranza, Interesados, Coaching,
// Usuarios y el borrado de datos no están aquí a propósito: son solo del administrador.

type Rule = { path: RegExp; methods?: string[] }
type ModuleDef = {
  key: string
  label: string
  hint: string
  group: "Clientes" | "Finanzas" | "Otros"
  href: string // pantalla principal, para los menús ("" = no tiene pantalla propia)
  byDefault: boolean
  sensitive?: boolean
  rules: Rule[]
}

const under = (base: string): Rule => ({ path: new RegExp(`^${base}(/|$)`) })
const only = (base: string, ...methods: string[]): Rule => ({ path: new RegExp(`^${base}$`), ...(methods.length ? { methods } : {}) })

export const STAFF_MODULES = [
  {
    key: "clients", label: "Clientes", hint: "Fichas, pagos, renovaciones y clases de los clientes", group: "Clientes", href: "/clients", byDefault: true,
    rules: [under("/clients"), { path: /^\/api\/clients(?!\/export(\/|$))(\/|$)/ }, under("/api/payments"), under("/api/schedule"), only("/api/upload/receipt"), { path: /^\/api\/memberships(\/|$)/, methods: ["GET"] }],
  },
  {
    key: "export", label: "Descargar clientes", hint: "Botón Exportar: la lista completa con sus datos", group: "Clientes", href: "", byDefault: true, sensitive: true,
    rules: [only("/api/clients/export", "GET")],
  },
  {
    key: "training", label: "Entrena. Personal", hint: "Lista de paquetes de clases personalizadas", group: "Clientes", href: "/training-plans", byDefault: true,
    rules: [under("/training-plans")],
  },
  {
    key: "nutrition", label: "Nutrición gym", hint: "Pacientes, consultas y agenda (datos de salud)", group: "Clientes", href: "/nutrition", byDefault: false, sensitive: true,
    rules: [under("/nutrition"), under("/api/nutrition")],
  },
  {
    key: "finances", label: "Finanzas básicas", hint: "Últimos movimientos, + Ingreso y + Egreso (sin totales)", group: "Finanzas", href: "/finances", byDefault: true,
    rules: [only("/finances"), only("/finances/income/new"), only("/finances/expenses/new"), only("/api/finances/income", "POST"), only("/api/finances/expenses", "POST")],
  },
  {
    key: "movements", label: "Ingresos y egresos", hint: "Historial completo: ver y borrar", group: "Finanzas", href: "/finances/income", byDefault: false, sensitive: true,
    rules: [only("/finances/income"), only("/finances/expenses"), under("/api/finances/income"), under("/api/finances/expenses")],
  },
  {
    key: "obligations", label: "Obligaciones", hint: "Cuadro anual de pagos del negocio", group: "Finanzas", href: "/finances/obligaciones", byDefault: false, sensitive: true,
    rules: [under("/finances/obligaciones"), under("/api/finances/obligations"), only("/api/finances/cash-plan", "POST")],
  },
  {
    key: "plan", label: "Plan del mes", hint: "Caja, prioridades de pago y ventas proyectadas", group: "Finanzas", href: "/finances/plan", byDefault: false, sensitive: true,
    rules: [under("/finances/plan"), under("/api/finances/cash-plan"), only("/api/finances/obligations", "POST")],
  },
  {
    key: "projection", label: "Proyección", hint: "Renovaciones del mes y saldos por cobrar", group: "Finanzas", href: "/finances/proyeccion", byDefault: false, sensitive: true,
    rules: [under("/finances/proyeccion"), under("/api/finances/renewal-projection")],
  },
  {
    key: "expenses", label: "Gastos", hint: "Gastos mensuales del negocio", group: "Finanzas", href: "/finances/monthly-expenses", byDefault: false, sensitive: true,
    rules: [under("/finances/monthly-expenses"), under("/api/finances/monthly-expenses")],
  },
  {
    key: "debts", label: "Deudas", hint: "Préstamos y deudas del negocio", group: "Finanzas", href: "/debts", byDefault: false, sensitive: true,
    rules: [under("/debts"), under("/api/debts")],
  },
  {
    key: "reports", label: "Reportes", hint: "Totales por mes y descarga en Excel", group: "Finanzas", href: "/finances/reports", byDefault: false, sensitive: true,
    rules: [under("/finances/reports"), under("/api/finances/reports"), under("/api/reports")],
  },
  {
    key: "memberships", label: "Membresías", hint: "Crear y cambiar planes y precios", group: "Otros", href: "/memberships", byDefault: false, sensitive: true,
    rules: [under("/memberships"), under("/api/memberships")],
  },
  {
    key: "dashboard", label: "Dashboard", hint: "Resumen general con los totales del mes", group: "Otros", href: "/dashboard", byDefault: false, sensitive: true,
    rules: [under("/dashboard"), under("/api/dashboard")],
  },
] as const satisfies readonly ModuleDef[]

export type StaffModule = (typeof STAFF_MODULES)[number]["key"]
const DEFS: readonly (ModuleDef & { key: StaffModule })[] = STAFF_MODULES
const KEYS = new Set<string>(DEFS.map((m) => m.key))

export const DEFAULT_STAFF_MODULES: StaffModule[] = DEFS.filter((m) => m.byDefault).map((m) => m.key)
export const NO_ACCESS_PATH = "/sin-acceso"

/** Solo claves conocidas, sin repetir y en el orden del catálogo. */
export function cleanModules(list: readonly unknown[]): StaffModule[] {
  return DEFS.filter((m) => list.includes(m.key)).map((m) => m.key)
}
export const isModuleList = (v: unknown): v is StaffModule[] => Array.isArray(v) && v.every((k) => typeof k === "string" && KEYS.has(k))

/** Lo guardado en la base ("clients,finances"); sin registro = accesos por defecto. */
export function parseModules(stored: string | null | undefined): StaffModule[] {
  return stored == null ? DEFAULT_STAFF_MODULES : cleanModules(stored.split(","))
}

// Lo mínimo para entrar, salir y recibir avisos
const ALWAYS: Rule[] = [only("/login"), only(NO_ACCESS_PATH), under("/api/auth"), under("/api/push"), under("/_next")]
const matches = (r: Rule, path: string, method: string) => r.path.test(path) && (!r.methods || r.methods.includes(method === "HEAD" ? "GET" : method))

export function staffCanOpen(modules: readonly string[], path: string, method = "GET"): boolean {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path
  return ALWAYS.some((r) => matches(r, p, method)) || DEFS.some((m) => modules.includes(m.key) && m.rules.some((r) => matches(r, p, method)))
}

/** Menú del staff: solo las pantallas que puede abrir. */
export function staffScreens(modules: readonly string[]): { key: StaffModule; label: string; href: string; group: ModuleDef["group"] }[] {
  return DEFS.filter((m) => m.href && modules.includes(m.key)).map(({ key, label, href, group }) => ({ key, label, href, group }))
}

/** Primera pantalla que le toca al entrar. */
export const staffHome = (modules: readonly string[]) => staffScreens(modules)[0]?.href ?? NO_ACCESS_PATH
