// utils/fileUtils.js

/**
 * Извлекает имя персонажа из имени файла
 * Правило: все, что до первого символа "_"
 * @param {string} filename - имя файла
 * @returns {string} - имя персонажа
 */
export const extractCharacterName = (filename) => {
  if (!filename) return 'Без персонажа'
  
  // Убираем расширение
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Ищем символ "_"
  const underscoreIndex = nameWithoutExt.indexOf('_')
  if (underscoreIndex > 0) {
    return nameWithoutExt.substring(0, underscoreIndex)
  }
  
  return 'Прочие'
}

/**
 * Группирует спрайты по персонажам
 * @param {Array} sprites - массив спрайтов
 * @returns {Object} - объект с группировкой { персонаж: [спрайты] }
 */
export const groupSpritesByCharacter = (sprites) => {
  const grouped = {}
  
  sprites.forEach(sprite => {
    const fileName = sprite.name || sprite.filename || ''
    const characterName = extractCharacterName(fileName)
    
    if (!grouped[characterName]) {
      grouped[characterName] = []
    }
    
    grouped[characterName].push({
      ...sprite,
      displayName: fileName,
      characterName: characterName
    })
  })
  
  // Сортируем спрайты внутри каждого персонажа по имени
  Object.keys(grouped).forEach(character => {
    grouped[character].sort((a, b) => {
      const nameA = (a.name || a.filename || '').toLowerCase()
      const nameB = (b.name || b.filename || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  })
  
  // Сортируем персонажей по алфавиту
  const sortedGrouped = {}
  Object.keys(grouped).sort().forEach(key => {
    sortedGrouped[key] = grouped[key]
  })
  
  return sortedGrouped
}

/**
 * Получает список уникальных персонажей
 * @param {Array} sprites - массив спрайтов
 * @returns {Array} - массив имен персонажей
 */
export const getUniqueCharacters = (sprites) => {
  const characters = new Set()
  sprites.forEach(sprite => {
    const fileName = sprite.name || sprite.filename || ''
    const character = extractCharacterName(fileName)
    characters.add(character)
  })
  return Array.from(characters).sort()
}

/**
 * Фильтрует спрайты по поисковому запросу и персонажу
 * @param {Array} sprites - массив спрайтов
 * @param {string} searchTerm - поисковый запрос
 * @param {string} selectedCharacter - выбранный персонаж ('all' или имя)
 * @returns {Array} - отфильтрованный массив
 */
export const filterSprites = (sprites, searchTerm, selectedCharacter) => {
  return sprites.filter(sprite => {
    const fileName = (sprite.name || sprite.filename || '').toLowerCase()
    const characterName = extractCharacterName(fileName)
    
    const matchesSearch = searchTerm === '' || 
      fileName.includes(searchTerm.toLowerCase())
    
    const matchesCharacter = selectedCharacter === 'all' || 
      characterName === selectedCharacter
    
    return matchesSearch && matchesCharacter
  })
}

/**
 * Валидирует имя файла
 * @param {string} name - имя файла
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateFileName = (name) => {
  if (!name || name.trim() === '') {
    return { isValid: false, error: 'Имя не может быть пустым' }
  }
  
  if (name.length > 100) {
    return { isValid: false, error: 'Имя не может быть длиннее 100 символов' }
  }
  
  const forbiddenChars = /[\\/*?:"<>|]/g
  if (forbiddenChars.test(name)) {
    return { isValid: false, error: 'Имя содержит запрещенные символы: \\ / * ? : " < > |' }
  }
  
  return { isValid: true, error: null }
}

/**
 * Проверяет, существует ли файл с таким именем
 * @param {Array} files - массив файлов
 * @param {string} newName - новое имя
 * @param {string} currentId - ID текущего файла (для исключения при переименовании)
 * @returns {boolean} - true если существует
 */
export const isFileNameExists = (files, newName, currentId = null) => {
  return files.some(file => {
    if (currentId && file.id === currentId) return false
    const fileName = (file.name || file.filename || '').toLowerCase()
    return fileName === newName.toLowerCase()
  })
}

/**
 * Генерирует уникальное имя файла
 * @param {Array} files - массив файлов
 * @param {string} baseName - базовое имя
 * @returns {string} - уникальное имя
 */
export const generateUniqueFileName = (files, baseName) => {
  let newName = baseName
  let counter = 1
  
  while (isFileNameExists(files, newName)) {
    newName = `${baseName}_${counter}`
    counter++
  }
  
  return newName
}