import * as types from './types'

/**
 * Content script for image captcha handling
 * @note This is inserted into the page context via puppeteer's `Page.evaluateOnNewDocument`
 */
export class ImageCaptchaContentScript {
  private opts: types.ContentScriptOpts
  private data: types.ContentScriptData

  constructor(
    opts: types.ContentScriptOpts = { visualFeedback: true },
    data: types.ContentScriptData = {}
  ) {
    this.opts = opts
    this.data = data
    this.debug('Constructor', { opts, data })
  }

  /** Logs debug messages if enabled */
  private debug(message: string, data?: any) {
    if (this.opts && this.opts.debugBinding) {
      try {
        // @ts-ignore
        if (window && window[this.opts.debugBinding]) {
          // @ts-ignore
          window[this.opts.debugBinding](message, data)
        }
      } catch (error) {
        /* No-op: Failed to use debug binding */
      }
    }
  }

  /** Add visual feedback to the captcha element */
  private visualFeedback(captchaInfo: types.CaptchaInfo, solved = false) {
    try {
      if (!this.opts.visualFeedback) {
        return
      }
      const imgElement = document.querySelector(
        `img[src="${captchaInfo.imageUrl}"]`
      ) as HTMLElement
      if (imgElement) {
        imgElement.style.border = solved
          ? '3px solid #0d84e3'
          : '3px solid #ff0000'
      }
    } catch (error) {
      this.debug('Error during visualFeedback', { error })
    }
  }

  /** 
   * Find image captchas on the page
   * @returns Detected captchas
   */
  public async findRecaptchas() {
    this.debug('findImageCaptchas')
    const result: types.FindRecaptchasResult = {
      captchas: [],
      filtered: [],
      error: null
    }

    try {
      // Common image captcha patterns
      const captchaSelectors = [
        'img[src*="captcha"]',
        'img[src*="CAPTCHA"]',
        'img[alt*="captcha"]',
        'img[alt*="CAPTCHA"]',
        'img[id*="captcha"]',
        'img[class*="captcha"]'
      ]

      for (const selector of captchaSelectors) {
        const elements = document.querySelectorAll(selector)
        for (let i = 0; i < elements.length; i++) {
          const img = elements[i] as HTMLImageElement
          if (!img || !img.src) continue

          try {
            // Create unique ID
            const id = `image_${Math.random().toString(36).substring(2, 9)}`
            
            // Create captcha info
            const captchaInfo: types.CaptchaInfo = {
              _vendor: 'image',
              id: id,
              imageUrl: img.src,
              url: window.location.href,
              isInViewport: this.isInViewport(img)
            }

            // Try to find related input field and submit button
            const inputElement = this.findRelatedInputField(img)
            if (inputElement) {
              captchaInfo.inputElement = this.getUniqueSelector(inputElement)
            }

            const submitButton = this.findSubmitButton(img, inputElement)
            if (submitButton) {
              captchaInfo.submitButton = this.getUniqueSelector(submitButton)
            }

            // Convert image to base64 if it's on the same origin
            try {
              if (this.isSameOrigin(img.src)) {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0)
                captchaInfo.imageBase64 = canvas.toDataURL('image/png')
              }
            } catch (error) {
              this.debug('Error converting image to base64', { error })
            }

            // Add visual feedback
            this.visualFeedback(captchaInfo)

            // Add to result
            result.captchas.push(captchaInfo)
          } catch (error) {
            this.debug('Error processing image', { error, src: img.src })
          }
        }
      }
    } catch (error) {
      result.error = error.toString()
      this.debug('Error finding image captchas', { error })
    }

    this.debug('findImageCaptchas - result', result)
    return result
  }

  /** 
   * Checks if an element is in the viewport
   */
  private isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  /**
   * Checks if a URL is from the same origin
   */
  private isSameOrigin(url: string): boolean {
    try {
      const srcUrl = new URL(url)
      return srcUrl.origin === window.location.origin
    } catch (error) {
      return false
    }
  }

  /**
   * Find related input field for a captcha image
   */
  private findRelatedInputField(imgElement: HTMLImageElement): HTMLElement | null {
    // Try to find the closest form
    let form = imgElement.closest('form')
    if (!form) {
      // Try to find a nearby form
      const forms = document.querySelectorAll('form')
      for (let i = 0; i < forms.length; i++) {
        if (forms[i].contains(imgElement)) {
          form = forms[i]
          break
        }
      }
    }

    // If we have a form, look for text inputs
    if (form) {
      // Common captcha input types
      const inputSelectors = [
        'input[name*="captcha"]',
        'input[id*="captcha"]',
        'input[class*="captcha"]',
        'input[type="text"]',
        'input:not([type])'
      ]

      for (const selector of inputSelectors) {
        const inputs = form.querySelectorAll(selector)
        for (let i = 0; i < inputs.length; i++) {
          // Skip hidden inputs
          if ((inputs[i] as HTMLInputElement).type === 'hidden') continue
          
          // Prioritize inputs with captcha in name/id/placeholder
          const inputEl = inputs[i] as HTMLInputElement
          const nameId = (inputEl.name || inputEl.id || '').toLowerCase()
          const placeholder = (inputEl.placeholder || '').toLowerCase()
          
          if (nameId.includes('captcha') || placeholder.includes('captcha')) {
            return inputEl
          }
        }
        
        // If no captcha-specific input found, return the first visible text input
        if (inputs.length > 0) {
          return inputs[0] as HTMLElement
        }
      }
    }

    // Try to find nearby text inputs if no form was found
    const closestInput = document.querySelector('input[type="text"][name*="captcha"], input[id*="captcha"]')
    if (closestInput) {
      return closestInput as HTMLElement
    }

    return null
  }

  /**
   * Find submit button related to captcha
   */
  private findSubmitButton(
    imgElement: HTMLImageElement, 
    inputElement: HTMLElement | null
  ): HTMLElement | null {
    // First try to find a form
    let form = imgElement.closest('form')
    
    // If input element exists, try its form
    if (!form && inputElement) {
      form = inputElement.closest('form')
    }

    if (form) {
      // Try submit input
      const submitInput = form.querySelector('input[type="submit"]')
      if (submitInput) return submitInput as HTMLElement

      // Try submit button
      const submitButton = form.querySelector('button[type="submit"]')
      if (submitButton) return submitButton as HTMLElement

      // Try button
      const button = form.querySelector('button')
      if (button) return button as HTMLElement
    }

    // Try nearby buttons/inputs
    const parentElement = imgElement.parentElement
    if (parentElement) {
      const button = parentElement.querySelector('button, input[type="submit"]')
      if (button) return button as HTMLElement
    }

    return null
  }

  /**
   * Get a unique selector for an element
   */
  private getUniqueSelector(element: HTMLElement): string {
    // Use ID if available
    if (element.id) {
      return `#${element.id}`
    }

    // Use name for inputs
    if (element.hasAttribute('name')) {
      const tagName = element.tagName.toLowerCase()
      const name = element.getAttribute('name')
      return `${tagName}[name="${name}"]`
    }

    // Generate path using classes and tags
    let path = ''
    let current = element
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()
      
      if (current.className) {
        const classes = current.className.split(/\s+/)
        if (classes.length > 0 && classes[0] !== '') {
          selector += `.${classes[0]}`
        }
      }
      
      // Add nth-of-type if needed
      const siblings = current.parentElement?.children || []
      if (siblings.length > 1) {
        let index = 1
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].tagName === current.tagName) {
            if (siblings[i] === current) {
              selector += `:nth-of-type(${index})`
              break
            }
            index++
          }
        }
      }
      
      path = selector + (path ? ' > ' + path : '')
      current = current.parentElement as HTMLElement
      
      // Limit path length
      if (path.split('>').length > 3) {
        break
      }
    }
    
    return path
  }

  /**
   * Enter image captcha solutions
   */
  public async enterRecaptchaSolutions() {
    this.debug('enterImageCaptchaSolutions', this.data)
    const solutions = this.data.solutions || []
    const result: types.EnterRecaptchaSolutionsResult = {
      solved: [],
      error: null
    }

    try {
      for (const solution of solutions) {
        if (solution._vendor !== 'image' || !solution.text) {
          continue
        }

        const captchaId = solution.id
        this.debug('Solving image captcha', { captchaId, solution })

        // Find elements based on selectors
        const solved: types.CaptchaSolved = {
          _vendor: 'image',
          id: captchaId,
          isSolved: false
        }

        try {
          // Looking for image, inputElement, and submitButton that we added to the solution
          // These are optional properties so we need to check if they exist
          const imageUrl = (solution as any).imageUrl
          const inputElementSelector = (solution as any).inputElement
          const submitButtonSelector = (solution as any).submitButton
          
          const image = imageUrl ? document.querySelector(`img[src="${imageUrl}"]`) : null
          
          // Find input field
          let inputElement: HTMLInputElement | null = null
          if (inputElementSelector) {
            inputElement = document.querySelector(inputElementSelector) as HTMLInputElement
          }

          if (!inputElement) {
            throw new Error('Input element not found')
          }

          // Enter the solution
          inputElement.value = solution.text
          inputElement.dispatchEvent(new Event('input', { bubbles: true }))
          inputElement.dispatchEvent(new Event('change', { bubbles: true }))

          // Try to find and click submit button if provided
          if (submitButtonSelector) {
            const submitButton = document.querySelector(submitButtonSelector) as HTMLElement
            if (submitButton) {
              setTimeout(() => {
                submitButton.click()
              }, 500)
            }
          }

          solved.isSolved = true
          solved.solvedAt = new Date()

          // Add visual feedback
          if (image && this.opts.visualFeedback) {
            (image as HTMLElement).style.border = '3px solid #0d84e3'
          }
        } catch (error) {
          solved.error = error.toString()
          this.debug('Error solving captcha', { captchaId, error })
        }

        result.solved.push(solved)
      }
    } catch (error) {
      result.error = error.toString()
      this.debug('Error entering solutions', { error })
    }

    this.debug('enterImageCaptchaSolutions - result', result)
    return result
  }
} 