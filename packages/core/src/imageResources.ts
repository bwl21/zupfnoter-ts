/** Reservierter Bildname für den beim Export erzeugten Player-QR-Code. */
export const PLAYER_QR_IMAGE_NAME = '$player_qr'

/** Prüft, ob ein Bildname das virtuelle Player-QR-Bild bezeichnet. */
export function isPlayerQrImageName(imageName: string): boolean {
  return imageName === PLAYER_QR_IMAGE_NAME
}
