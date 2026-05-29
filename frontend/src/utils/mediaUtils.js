/**
 * Утилиты для работы с URL медиа-файлов.
 * Централизует логику определения абсолютного пути.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Проверяет, является ли URL абсолютным.
 */
const isAbsoluteUrl = (url) => {
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Преобразует относительный путь в абсолютный URL.
 * @param {string|null|undefined} url - путь или URL
 * @returns {string|null} - абсолютный URL или null
 */
export const getMediaUrl = (url) => {
  if (!url) return null
  if (isAbsoluteUrl(url)) return url
  // Убираем начальный слеш, если есть
  const cleanPath = url.startsWith('/') ? url : `/${url}`
  return `${API_BASE_URL}${cleanPath}`
}

/**
 * Извлекает имя файла из URL или пути.
 * @param {string} url - URL или путь
 * @returns {string} - имя файла
 */
export const getFileNameFromUrl = (url) => {
  if (!url) return ''
  const parts = url.split('/')
  return parts[parts.length - 1] || ''
}

/**
 * Ищет файл в массиве по различным критериям (name, filename, url).
 * @param {Array} files - массив файлов
 * @param {string} searchFileName - имя файла для поиска
 * @returns {object|null} - найденный файл или null
 */
export const findFileByName = (files, searchFileName) => {
  if (!files?.length || !searchFileName) return null

  const search = searchFileName.toLowerCase()
  const searchBase = getFileNameFromUrl(search).toLowerCase()

  return (
    files.find(f => getFileNameFromUrl(f.url || '').toLowerCase() === searchBase) ||
    files.find(f => (f.filename || '').toLowerCase() === search) ||
    files.find(f => (f.name || '').toLowerCase() === search) ||
    files.find(f => f.id === searchFileName) ||
    files.find(f => {
      const fn = (f.filename || f.name || '').toLowerCase()
      return fn === search || fn.includes(search) || search.includes(fn)
    }) ||
    null
  )
}