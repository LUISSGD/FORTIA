import { Fragment } from "react"

// Muestra las respuestas del asistente: títulos, listas, tablas, negritas. A propósito NO crea enlaces ni imágenes:
// el texto viene de una IA que lee datos escritos por otras personas.

function inline(text: string): React.ReactNode[] {
  // [texto](url) se muestra como texto
  const plain = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
  return plain.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\b_[^_]+_\b)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-gray-100 px-1 text-[0.92em]">{p.slice(1, -1)}</code>
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    return <Fragment key={i}>{p}</Fragment>
  })
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isDivider = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-")
const cells = (l: string) => l.trim().slice(1, -1).split("|").map((c) => c.trim())
const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*(\d+)[.)]\s+/

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n")
  const out: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    const key = out.length
    if (!l.trim()) { i++; continue }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push(<hr key={key} className="border-gray-200" />); i++; continue }
    const h = l.match(/^#{1,6}\s+(.*)$/)
    if (h) { out.push(<p key={key} className="pt-1 text-[15px] font-bold text-gray-900">{inline(h[1].replace(/\*\*/g, ""))}</p>); i++; continue }
    if (isTableRow(l) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(l)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]))
      out.push(
        <div key={key} className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr>{head.map((c, n) => <th key={n} className="border-b border-gray-300 py-1.5 pr-4 text-left font-semibold text-gray-900">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.map((r, n) => <tr key={n} className="border-b border-gray-100 last:border-0">{head.map((_, m) => <td key={m} className="py-1.5 pr-4 align-top tabular-nums">{inline(r[m] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }
    if (BULLET.test(l) || NUMBER.test(l)) {
      const items: { text: string; mark: string; depth: number }[] = []
      while (i < lines.length && (BULLET.test(lines[i]) || NUMBER.test(lines[i]))) {
        const depth = Math.min(2, Math.floor((lines[i].match(/^\s*/)![0].length + 1) / 2))
        const n = lines[i].match(NUMBER)
        items.push({ text: lines[i].replace(n ? NUMBER : BULLET, ""), mark: n ? `${n[1]}.` : "•", depth })
        i++
      }
      out.push(
        <ul key={key} className="space-y-1">
          {items.map((it, n) => (
            <li key={n} className="flex gap-2" style={{ marginLeft: it.depth * 16 }}><span className="shrink-0 tabular-nums text-gray-400">{it.mark}</span><span className="min-w-0">{inline(it.text)}</span></li>
          ))}
        </ul>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s/.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i]) && !(isTableRow(lines[i]) && i + 1 < lines.length && isDivider(lines[i + 1]))) para.push(lines[i++].replace(/^>\s?/, ""))
    if (!para.length) { para.push(lines[i++]) }
    out.push(<p key={key}>{para.map((p, n) => <Fragment key={n}>{n > 0 && <br />}{inline(p)}</Fragment>)}</p>)
  }
  return <div className="space-y-2.5 break-words text-sm leading-relaxed text-gray-700">{out}</div>
}
