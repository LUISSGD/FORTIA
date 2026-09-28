import ImportClient from "./ImportClient"

export default function ImportPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Importar desde Harbiz (u otra plataforma)</h1>
        <p className="text-sm text-gray-500">
          Exporta tus datos a Excel o CSV y súbelos aquí. Las columnas se reconocen por su nombre (español o inglés); si tu archivo no coincide, copia los datos en la plantilla.
          Primero siempre verás una vista previa, sin guardar nada.
        </p>
      </div>
      <ImportClient />
    </>
  )
}
