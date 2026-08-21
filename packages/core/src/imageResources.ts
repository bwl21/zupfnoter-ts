/** Reservierter Bildname für den beim Export erzeugten Übungs-QR-Code. */
export const PRACTICE_QR_IMAGE_NAME = '$player_qr'

/** Prüft, ob ein Bildname das virtuelle Übungs-QR-Bild bezeichnet. */
export function isPracticeQrImageName(imageName: string): boolean {
  return imageName === PRACTICE_QR_IMAGE_NAME
}

/** @deprecated Verwende PRACTICE_QR_IMAGE_NAME; der Wert bleibt ABC-kompatibel. */
export const PLAYER_QR_IMAGE_NAME = PRACTICE_QR_IMAGE_NAME

/** @deprecated Verwende isPracticeQrImageName. */
export const isPlayerQrImageName = isPracticeQrImageName
