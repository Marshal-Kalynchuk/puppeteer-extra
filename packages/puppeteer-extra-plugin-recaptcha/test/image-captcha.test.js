const { PuppeteerExtraPluginRecaptcha } = require('../dist/index')

describe('Image Captcha', () => {
  let plugin

  beforeEach(() => {
    plugin = new PuppeteerExtraPluginRecaptcha({
      visualFeedback: true,
      solveImageCaptchas: true
    })
    plugin.onPageCreated = jest.fn()
  })

  test('will correctly add image vendor to contentscript', async () => {
    const content = plugin._generateContentScript('image', 'findRecaptchas')
    expect(content).toContain('ImageCaptchaContentScript')
  })

  test('will solve image captcha when enabled', async () => {
    const contentGetter = jest.spyOn(plugin, '_generateContentScript')
    
    const mockPage = getMockPage()
    
    // Mock response for findRecaptchas
    const mockImageCaptchas = {
      captchas: [
        {
          _vendor: 'image',
          id: 'image_123',
          imageUrl: 'https://example.com/captcha.jpg',
          imageBase64: 'data:image/png;base64,abc123',
          url: 'https://example.com',
          inputElement: 'input[name="captcha"]',
          submitButton: 'button[type="submit"]'
        }
      ],
      error: null
    }
    
    const mockSolutions = {
      solutions: [
        {
          _vendor: 'image',
          id: 'image_123',
          text: 'abc123',
          imageUrl: 'https://example.com/captcha.jpg',
          inputElement: 'input[name="captcha"]',
          submitButton: 'button[type="submit"]'
        }
      ],
      error: null
    }
    
    const mockSolved = {
      solved: [
        {
          _vendor: 'image',
          id: 'image_123',
          isSolved: true
        }
      ],
      error: null
    }
    
    // Setup mocks
    mockPage.evaluate.mockImplementation((code) => {
      if (code.includes('findRecaptchas') && code.includes('ImageCaptchaContentScript')) {
        return mockImageCaptchas
      } else if (code.includes('enterRecaptchaSolutions')) {
        return mockSolved
      }
      return { captchas: [], error: null }
    })
    
    plugin.getRecaptchaSolutions = jest.fn().mockResolvedValue(mockSolutions)
    
    // Run test
    const result = await plugin.solveRecaptchas(mockPage)
    
    // Verify
    expect(result.captchas).toHaveLength(1)
    expect(result.captchas[0]._vendor).toBe('image')
    expect(result.solutions).toHaveLength(1)
    expect(result.solutions[0].text).toBe('abc123')
    expect(result.solved).toHaveLength(1)
    expect(result.solved[0].isSolved).toBe(true)
    
    expect(contentGetter).toHaveBeenCalledWith('image', 'findRecaptchas')
    expect(contentGetter).toHaveBeenCalledWith('image', 'enterRecaptchaSolutions', { solutions: mockSolutions.solutions })
  })
  
  test('will filter out image captchas when disabled', async () => {
    plugin = new PuppeteerExtraPluginRecaptcha({
      visualFeedback: true,
      solveImageCaptchas: false // Disabled
    })
    
    const mockPage = getMockPage()
    
    // Mock response for findRecaptchas
    const mockImageCaptchas = {
      captchas: [
        {
          _vendor: 'image',
          id: 'image_123',
          imageUrl: 'https://example.com/captcha.jpg',
          imageBase64: 'data:image/png;base64,abc123',
          url: 'https://example.com'
        }
      ],
      error: null
    }
    
    // Setup mocks
    mockPage.evaluate.mockImplementation((code) => {
      if (code.includes('findRecaptchas') && code.includes('ImageCaptchaContentScript')) {
        return mockImageCaptchas
      }
      return { captchas: [], error: null }
    })
    
    // Run test
    const result = await plugin.findRecaptchas(mockPage)
    
    // Verify image captchas were filtered out
    expect(result.captchas).toHaveLength(0)
    expect(result.filtered).toHaveLength(1)
    expect(result.filtered[0]._vendor).toBe('image')
    expect(result.filtered[0].filteredReason).toBe('solveImageCaptchas')
  })
})

function getMockPage() {
  return {
    evaluate: jest.fn(),
    $: jest.fn().mockResolvedValue(null),
    waitForFunction: jest.fn().mockResolvedValue(true),
    exposeFunction: jest.fn().mockResolvedValue(true)
  }
} 