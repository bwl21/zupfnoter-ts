/** Seitenformat einer erzeugten PDF-Datei. */
export type PdfPageFormat = 'A3' | 'A4'

/**
 * Bildet den fachlichen Namen einer PDF-Ausgabe nach der Legacy-Konvention.
 *
 * Der Dateinamen-Zusatz stammt unverändert aus `extract.<nr>.filenamepart`.
 * Dadurch bleiben gespeicherte Ausgaben zwischen Web-Anwendung und späterem
 * CLI kompatibel.
 */
export function pdfOutputFilename(filebase: string, filenamepart: string, pageFormat: PdfPageFormat): string {
  return `${filebase}_${filenamepart}_${pageFormat.toLowerCase()}.pdf`
}
