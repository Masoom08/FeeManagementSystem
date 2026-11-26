import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Alert, Platform } from 'react-native'
import type { PaymentReceipt, Student } from '../types/fee'

const instituteName = 'Institute of Co-operative & Corporate Management, Research & Training'
const navy = rgb(18 / 255, 63 / 255, 117 / 255)
const yellow = rgb(1, 192 / 255, 0)
const ink = rgb(37 / 255, 50 / 255, 71 / 255)
const muted = rgb(105 / 255, 120 / 255, 139 / 255)
const pale = rgb(243 / 255, 247 / 255, 251 / 255)
const line = rgb(221 / 255, 229 / 255, 237 / 255)
const green = rgb(34 / 255, 130 / 255, 83 / 255)

function safeText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '?')
}

function drawWrapped(page: any, value: string, x: number, y: number, maxWidth: number, font: any, size: number, color = ink, lineHeight = size + 4) {
  const words = safeText(value).split(/\s+/)
  let row = ''
  let cursorY = y
  for (const word of words) {
    const next = row ? `${row} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > maxWidth && row) {
      page.drawText(row, { x, y: cursorY, size, font, color })
      cursorY -= lineHeight
      row = word
    } else row = next
  }
  if (row) page.drawText(row, { x, y: cursorY, size, font, color })
  return cursorY - lineHeight
}

function drawField(page: any, label: string, value: string, x: number, y: number, width: number, regular: any, bold: any) {
  page.drawText(label.toUpperCase(), { x, y, size: 8, font: bold, color: muted })
  drawWrapped(page, value || '-', x, y - 18, width, regular, 10, ink, 13)
}

async function loadLogoBase64() {
  const asset = Asset.fromModule(require('../../assets/logo-iccmrt.png'))
  await asset.downloadAsync()
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri)
    if (!response.ok) throw new Error('Institute logo could not be loaded.')
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Institute logo could not be read.'))
      reader.onerror = () => reject(new Error('Institute logo could not be read.'))
      reader.readAsDataURL(blob)
    })
    return dataUrl.split(',')[1]
  }
  if (!asset.localUri) throw new Error('Institute logo could not be loaded.')
  return FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 })
}

async function buildReceiptPdf(student: Student, receipt: PaymentReceipt) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Fee receipt ${receipt.receiptNo}`)
  pdf.setAuthor(instituteName)
  pdf.setSubject(`Fee payment receipt for ${student.name}`)
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await pdf.embedPng(`data:image/png;base64,${await loadLogoBase64()}`)
  const pageWidth = page.getWidth()

  page.drawRectangle({ x: 0, y: 723, width: pageWidth, height: 119, color: navy })
  page.drawImage(logo, { x: 38, y: 750, width: 72, height: 72 })
  page.drawText('ICCMRT', { x: 128, y: 797, size: 19, font: bold, color: rgb(1, 1, 1) })
  drawWrapped(page, instituteName, 128, 779, 365, regular, 9, rgb(0.88, 0.93, 0.98), 12)
  page.drawText('FEE PAYMENT RECEIPT', { x: 128, y: 744, size: 9, font: bold, color: yellow })

  page.drawText('OFFICIAL RECEIPT', { x: 42, y: 687, size: 10, font: bold, color: muted })
  page.drawText(safeText(receipt.receiptNo), { x: 42, y: 659, size: 18, font: bold, color: navy })
  page.drawRectangle({ x: 442, y: 650, width: 111, height: 31, color: rgb(0.9, 0.97, 0.93), borderColor: rgb(0.78, 0.9, 0.83), borderWidth: 1 })
  page.drawText('PAID', { x: 479, y: 661, size: 10, font: bold, color: green })

  page.drawRectangle({ x: 38, y: 440, width: 519, height: 184, color: pale, borderColor: line, borderWidth: 1 })
  drawField(page, 'Student name', student.name, 56, 594, 220, regular, bold)
  drawField(page, 'Registration number', student.registrationNo, 310, 594, 220, regular, bold)
  drawField(page, 'Course', student.course, 56, 540, 220, regular, bold)
  drawField(page, 'Academic year / batch', String(student.batch), 310, 540, 220, regular, bold)
  drawField(page, 'Study year', `Year ${student.year}`, 56, 486, 220, regular, bold)
  drawField(page, 'Payment date', receipt.paymentDate, 310, 486, 220, regular, bold)

  page.drawText('PAYMENT DETAILS', { x: 42, y: 407, size: 10, font: bold, color: muted })
  page.drawRectangle({ x: 38, y: 361, width: 519, height: 31, color: navy })
  page.drawText('DESCRIPTION', { x: 53, y: 372, size: 8, font: bold, color: rgb(1, 1, 1) })
  page.drawText('METHOD', { x: 365, y: 372, size: 8, font: bold, color: rgb(1, 1, 1) })
  page.drawText('AMOUNT (INR)', { x: 455, y: 372, size: 8, font: bold, color: rgb(1, 1, 1) })

  const semesterDescription = receipt.product === 'HOSTEL'
    ? 'Hostel fee payment'
    : receipt.semesters.length
      ? `Fee payment for ${receipt.semesters.map(number => `Semester ${number}`).join(', ')}`
      : 'Student fee payment'
  drawWrapped(page, semesterDescription, 53, 339, 285, regular, 10, ink, 13)
  drawWrapped(page, safeText(receipt.method), 365, 339, 78, regular, 9, ink, 12)
  const amount = `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(receipt.amount)}`
  page.drawText(amount, { x: 455, y: 339, size: 9, font: bold, color: ink })
  page.drawLine({ start: { x: 38, y: 314 }, end: { x: 557, y: 314 }, thickness: 1, color: line })
  page.drawText('TOTAL PAID', { x: 350, y: 284, size: 10, font: bold, color: ink })
  page.drawText(amount, { x: 455, y: 282, size: 12, font: bold, color: navy })

  page.drawRectangle({ x: 38, y: 193, width: 519, height: 55, color: rgb(1, 0.97, 0.87) })
  drawWrapped(page, 'This receipt confirms that the payment listed above has been recorded by the institute.', 54, 225, 487, regular, 9, ink, 13)
  page.drawText('Please retain this receipt for your records.', { x: 54, y: 207, size: 8, font: regular, color: muted })

  page.drawLine({ start: { x: 55, y: 115 }, end: { x: 230, y: 115 }, thickness: 1, color: line })
  page.drawLine({ start: { x: 365, y: 115 }, end: { x: 540, y: 115 }, thickness: 1, color: line })
  page.drawText('Student signature', { x: 55, y: 99, size: 8, font: regular, color: muted })
  page.drawText('Authorized signatory', { x: 365, y: 99, size: 8, font: regular, color: muted })
  page.drawLine({ start: { x: 38, y: 68 }, end: { x: 557, y: 68 }, thickness: 1, color: line })
  page.drawText('ICCMRT Fee Management System', { x: 38, y: 49, size: 8, font: bold, color: navy })
  page.drawText('Computer-generated receipt', { x: 410, y: 49, size: 8, font: regular, color: muted })

  return pdf.saveAsBase64({ dataUri: false })
}

function safeFileName(receiptNo: string) {
  return `ICCMRT-${receiptNo.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`
}

async function saveOnAndroid(base64: string, fileName: string) {
  const initialDirectory = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download')
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialDirectory)
  if (!permission.granted) return false
  const nameWithoutExtension = fileName.replace(/\.pdf$/i, '')
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, nameWithoutExtension, 'application/pdf')
  await FileSystem.StorageAccessFramework.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 })
  return true
}

async function saveOnIos(base64: string, fileName: string) {
  if (!FileSystem.documentDirectory) throw new Error('The device document folder is unavailable.')
  const receiptDirectory = `${FileSystem.documentDirectory}Receipts/`
  const directory = await FileSystem.getInfoAsync(receiptDirectory)
  if (!directory.exists) await FileSystem.makeDirectoryAsync(receiptDirectory, { intermediates: true })
  const fileUri = `${receiptDirectory}${fileName}`
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 })
  return fileUri
}

function downloadOnWeb(base64: string, fileName: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadFeeReceipt(student: Student, receipt: PaymentReceipt) {
  try {
    const base64 = await buildReceiptPdf(student, receipt)
    const fileName = safeFileName(receipt.receiptNo)
    if (Platform.OS === 'web') {
      downloadOnWeb(base64, fileName)
      return
    }
    if (Platform.OS === 'android') {
      const saved = await saveOnAndroid(base64, fileName)
      if (saved) Alert.alert('Receipt downloaded', `${fileName} was saved to the selected folder.`)
      return
    }
    const fileUri = await saveOnIos(base64, fileName)
    Alert.alert('Receipt downloaded', `Saved to Files > On My iPhone > ICCMRT Fee Portal > Receipts.\n${fileUri.split('/').pop()}`)
  } catch (error) {
    Alert.alert('Could not download receipt', error instanceof Error ? error.message : 'Please try again.')
  }
}
