/**
 * Тесты для утилит работы с файлами.
 */
import {
  extractCharacterName,
  groupSpritesByCharacter,
  getUniqueCharacters,
  filterSprites,
  validateFileName,
  isFileNameExists,
  generateUniqueFileName
} from '../utils/fileUtils'

describe('extractCharacterName', () => {
  test('extracts character name from filename', () => {
    expect(extractCharacterName('Anna_smile.png')).toBe('Anna')
    expect(extractCharacterName('John_angry.jpg')).toBe('John')
    expect(extractCharacterName('Boss_final_form.webp')).toBe('Boss')
  })
  
  test('returns "Прочие" for files without underscore', () => {
    expect(extractCharacterName('background.png')).toBe('Прочие')
    expect(extractCharacterName('logo.jpg')).toBe('Прочие')
  })
  
  test('handles empty filename', () => {
    expect(extractCharacterName('')).toBe('Без персонажа')
    expect(extractCharacterName(null)).toBe('Без персонажа')
    expect(extractCharacterName(undefined)).toBe('Без персонажа')
  })
  
  test('handles filename with extension', () => {
    expect(extractCharacterName('Anna_smile.v2.png')).toBe('Anna')
  })
})

describe('groupSpritesByCharacter', () => {
  const sampleSprites = [
    { id: '1', name: 'Anna_smile.png', url: '/sprites/1' },
    { id: '2', name: 'Anna_angry.png', url: '/sprites/2' },
    { id: '3', name: 'John_neutral.png', url: '/sprites/3' },
    { id: '4', name: 'logo.png', url: '/sprites/4' },
  ]
  
  test('groups sprites by character', () => {
    const grouped = groupSpritesByCharacter(sampleSprites)
    
    expect(Object.keys(grouped)).toHaveLength(3)
    expect(grouped['Anna']).toHaveLength(2)
    expect(grouped['John']).toHaveLength(1)
    expect(grouped['Прочие']).toHaveLength(1)
  })
  
  test('sorts sprites within groups alphabetically', () => {
    const sprites = [
      { id: '1', name: 'Anna_z_angry.png' },
      { id: '2', name: 'Anna_a_smile.png' },
      { id: '3', name: 'Anna_m_neutral.png' },
    ]
    
    const grouped = groupSpritesByCharacter(sprites)
    const annaSprites = grouped['Anna']
    
    expect(annaSprites[0].name).toBe('Anna_a_smile.png')
    expect(annaSprites[1].name).toBe('Anna_m_neutral.png')
    expect(annaSprites[2].name).toBe('Anna_z_angry.png')
  })
  
  test('handles empty array', () => {
    const grouped = groupSpritesByCharacter([])
    expect(Object.keys(grouped)).toHaveLength(0)
  })
})

describe('getUniqueCharacters', () => {
  test('returns sorted unique character names', () => {
    const sprites = [
      { name: 'Zelda_smile.png' },
      { name: 'Anna_neutral.png' },
      { name: 'Anna_angry.png' },
      { name: 'Bob_happy.png' },
    ]
    
    const characters = getUniqueCharacters(sprites)
    
    expect(characters).toEqual(['Anna', 'Bob', 'Zelda'])
  })
  
  test('handles empty array', () => {
    expect(getUniqueCharacters([])).toEqual([])
  })
})

describe('filterSprites', () => {
  const sprites = [
    { id: '1', name: 'Anna_smile.png' },
    { id: '2', name: 'Anna_angry.png' },
    { id: '3', name: 'John_neutral.png' },
    { id: '4', name: 'logo.png' },
  ]
  
  test('filters by search term', () => {
    const filtered = filterSprites(sprites, 'angry', 'all')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Anna_angry.png')
  })
  
  test('filters by character', () => {
    const filtered = filterSprites(sprites, '', 'Anna')
    expect(filtered).toHaveLength(2)
  })
  
  test('filters by character and search term', () => {
    const filtered = filterSprites(sprites, 'smile', 'Anna')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Anna_smile.png')
  })
  
  test('returns all when no filters', () => {
    const filtered = filterSprites(sprites, '', 'all')
    expect(filtered).toHaveLength(4)
  })
  
  test('case insensitive search', () => {
    const filtered = filterSprites(sprites, 'ANGRY', 'all')
    expect(filtered).toHaveLength(1)
  })
})

describe('validateFileName', () => {
  test('validates correct filename', () => {
    expect(validateFileName('test_file').isValid).toBe(true)
    expect(validateFileName('hello').isValid).toBe(true)
    expect(validateFileName('Anna_smile').isValid).toBe(true)
  })
  
  test('rejects empty filename', () => {
    const result = validateFileName('')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Имя не может быть пустым')
  })
  
  test('rejects whitespace-only filename', () => {
    const result = validateFileName('   ')
    expect(result.isValid).toBe(false)
  })
  
  test('rejects filename with forbidden characters', () => {
    expect(validateFileName('test/file').isValid).toBe(false)
    expect(validateFileName('test:file').isValid).toBe(false)
    expect(validateFileName('test*file').isValid).toBe(false)
    expect(validateFileName('test?file').isValid).toBe(false)
    expect(validateFileName('test<file').isValid).toBe(false)
    expect(validateFileName('test>file').isValid).toBe(false)
    expect(validateFileName('test|file').isValid).toBe(false)
  })
  
  test('rejects too long filename', () => {
    const longName = 'a'.repeat(101)
    expect(validateFileName(longName).isValid).toBe(false)
  })
  
  test('accepts filename at max length', () => {
    const maxName = 'a'.repeat(100)
    expect(validateFileName(maxName).isValid).toBe(true)
  })
})

describe('isFileNameExists', () => {
  const files = [
    { id: '1', name: 'Anna_smile.png' },
    { id: '2', name: 'Anna_angry.png' },
    { id: '3', name: 'logo.png' },
  ]
  
  test('finds existing filename', () => {
    expect(isFileNameExists(files, 'Anna_smile.png')).toBe(true)
    expect(isFileNameExists(files, 'logo.png')).toBe(true)
  })
  
  test('returns false for non-existing filename', () => {
    expect(isFileNameExists(files, 'nonexistent.png')).toBe(false)
  })
  
  test('excludes current file when renaming', () => {
    expect(isFileNameExists(files, 'Anna_smile.png', '1')).toBe(false)
  })
  
  test('case insensitive comparison', () => {
    expect(isFileNameExists(files, 'ANNA_SMILE.PNG')).toBe(true)
  })
})

describe('generateUniqueFileName', () => {
  const files = [
    { id: '1', name: 'test' },
    { id: '2', name: 'test_1' },
  ]
  
  test('generates unique name when no conflict', () => {
    expect(generateUniqueFileName(files, 'unique')).toBe('unique')
  })
  
  test('generates unique name with counter', () => {
    expect(generateUniqueFileName(files, 'test')).toBe('test_2')
  })
  
  test('increments counter until unique', () => {
    const moreFiles = [
      ...files,
      { id: '3', name: 'test_2' },
    ]
    expect(generateUniqueFileName(moreFiles, 'test')).toBe('test_3')
  })
})