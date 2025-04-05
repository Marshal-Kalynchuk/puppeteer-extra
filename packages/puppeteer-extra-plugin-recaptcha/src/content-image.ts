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
      // Track processed image URLs to avoid duplicates
      const processedUrls = new Set<string>()

      // Find all forms in the document
      const forms = document.querySelectorAll('form')
      this.debug(`Found ${forms.length} forms on the page`)

      // Function to check if an image is a captcha (case insensitive)
      const isCaptchaImage = (img: HTMLImageElement): boolean => {
        const src = img.src.toLowerCase()
        const alt = (img.alt || '').toLowerCase()
        const id = (img.id || '').toLowerCase()
        const className = (img.className || '').toLowerCase()
        
        return (
          src.includes('captcha') ||
          alt.includes('captcha') ||
          id.includes('captcha') ||
          className.includes('captcha')
        )
      }

      // Process a captcha image and add it to results
      const processCaptchaImage = (img: HTMLImageElement) => {
        if (!img || !img.src) return
        
        // Skip if this URL has already been processed
        if (processedUrls.has(img.src)) {
          this.debug('Skipping duplicate image', { src: img.src })
          return
        }

        // Mark this URL as processed
        processedUrls.add(img.src)

        try {
          // Create unique ID
          const id = `image_${Math.random().toString(36).substring(2, 9)}`
          
          // Create captcha info - use original URL
          const captchaInfo: types.CaptchaInfo = {
            _vendor: 'image',
            id: id,
            imageUrl: img.src, // Preserve original URL
            url: window.location.href,
            isInViewport: this.isInViewport(img)
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

      // First try to find captchas within forms
      for (const form of Array.from(forms)) {
        // Get all images within the form
        const images = form.querySelectorAll('img')
        this.debug(`Found ${images.length} images within a form`)
        
        for (let i = 0; i < images.length; i++) {
          const img = images[i] as HTMLImageElement
          // Check if this is a captcha image using case-insensitive check
          if (isCaptchaImage(img)) {
            processCaptchaImage(img)
          }
        }
      }

      // Second resort: look for captchas outside of forms
      if (result.captchas.length === 0) {
        this.debug('No captchas found in forms, looking everywhere')
        const allImages = document.querySelectorAll('img')
        this.debug(`Found ${allImages.length} images on the page`)
        
        for (let i = 0; i < allImages.length; i++) {
          const img = allImages[i] as HTMLImageElement
          // Check if this is a captcha image using case-insensitive check
          if (isCaptchaImage(img)) {
            processCaptchaImage(img)
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
    this.debug('Finding related input field for image', { src: imgElement.src })
    
    // Strategy 1: Check for form-based inputs
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

    // Common input selectors to try (case insensitive)
    const inputSelectors = [
      'input[name*="captcha" i]',
      'input[id*="captcha" i]',
      'input[class*="captcha" i]',
      'input[placeholder*="captcha" i]',
      'input[placeholder*="enter text" i]',
      'input[placeholder*="answer" i]',
      'input[aria-label*="captcha" i]',
      'input[type="text"]',
      'input:not([type])'
    ]

    // Strategy 2: If we have a form, search within it
    if (form) {
      this.debug('Found form, searching within it for inputs')
      
      // First try captcha-specific inputs
      for (const selector of inputSelectors) {
        const inputs = form.querySelectorAll(selector)
        for (let i = 0; i < inputs.length; i++) {
          const inputEl = inputs[i] as HTMLInputElement
          if (inputEl.type === 'hidden') continue
          
          this.debug('Found input within form', { 
            selector, 
            name: inputEl.name, 
            id: inputEl.id 
          })
          return inputEl
        }
      }
    }

    // Strategy 3: Look in the closest common parent container
    // This helps with table-based layouts or div structures
    let currentNode: HTMLElement | null = imgElement;
    const maxLevelsUp = 5; // Don't go too far up the DOM tree
    
    for (let i = 0; i < maxLevelsUp && currentNode; i++) {
      currentNode = currentNode.parentElement;
      if (!currentNode) break;
      
      // Check if this parent contains any inputs
      for (const selector of inputSelectors) {
        const inputs = currentNode.querySelectorAll(selector);
        for (let j = 0; j < inputs.length; j++) {
          const input = inputs[j] as HTMLInputElement;
          if (input.type === 'hidden') continue;
          
          this.debug('Found input in parent container', { 
            level: i, 
            containerTag: currentNode.tagName,
            inputName: input.name, 
            inputId: input.id 
          });
          return input;
        }
      }
      
      // Special case for table structures - check siblings of parent
      if (currentNode.tagName === 'TD' || currentNode.tagName === 'TR') {
        const siblingRows = currentNode.parentElement?.children || [];
        for (let j = 0; j < siblingRows.length; j++) {
          const inputs = siblingRows[j].querySelectorAll('input[type="text"]');
          if (inputs.length > 0) {
            this.debug('Found input in sibling table row', {
              inputName: (inputs[0] as HTMLInputElement).name,
              inputId: (inputs[0] as HTMLInputElement).id
            });
            return inputs[0] as HTMLElement;
          }
        }
      }
    }

    // Strategy 4: Check siblings and nearby elements (for non-form layouts)
    currentNode = imgElement.parentElement;
    if (currentNode) {
      // Check sibling elements
      const siblings = currentNode.parentElement?.children || [];
      for (let i = 0; i < siblings.length; i++) {
        if (siblings[i] === currentNode) continue; // Skip the image container itself
        
        // Check for inputs directly in sibling
        const inputs = siblings[i].querySelectorAll('input[type="text"]');
        if (inputs.length > 0) {
          this.debug('Found input in sibling element', {
            siblingTag: siblings[i].tagName,
            inputName: (inputs[0] as HTMLInputElement).name,
            inputId: (inputs[0] as HTMLInputElement).id
          });
          return inputs[0] as HTMLElement;
        }
        
        // Or nested in sibling's children
        const nestedInputs = siblings[i].querySelectorAll('input');
        for (let j = 0; j < nestedInputs.length; j++) {
          const input = nestedInputs[j] as HTMLInputElement;
          if (input.type !== 'hidden') {
            this.debug('Found nested input in sibling', {
              inputName: input.name,
              inputId: input.id
            });
            return input;
          }
        }
      }
    }

    // Strategy 5: Last resort - try to find any text input near the image in the document
    const allInputs = document.querySelectorAll('input[type="text"]');
    if (allInputs.length > 0) {
      // Find input that's closest to the captcha image in DOM position
      const imgRect = imgElement.getBoundingClientRect();
      let closestInput = null;
      let closestDistance = Infinity;
      
      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i] as HTMLInputElement;
        const inputRect = input.getBoundingClientRect();
        
        // Calculate distance (simple euclidean distance of centers)
        const dx = (imgRect.left + imgRect.width/2) - (inputRect.left + inputRect.width/2);
        const dy = (imgRect.top + imgRect.height/2) - (inputRect.top + inputRect.height/2);
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestInput = input;
        }
      }
      
      if (closestInput && closestDistance < 500) { // Limit to a reasonable distance
        this.debug('Found closest input by proximity', {
          distance: closestDistance,
          inputName: closestInput.name,
          inputId: closestInput.id
        });
        return closestInput;
      }
    }

    this.debug('Could not find related input field');
    return null;
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
          // Find the image element using the imageUrl from the solution
          const imageUrl = (solution as any).imageUrl
          if (!imageUrl) {
            throw new Error('Missing image URL in solution')
          }
          
          // Try different methods to find the image
          this.debug('Looking for image with URL', { imageUrl })
          
          // Method 1: Direct URL match (handles both relative and absolute URLs)
          let image = document.querySelector(`img[src="${imageUrl}"]`) as HTMLImageElement
          
          // Method 2: Try with just the filename (for relative URLs)
          if (!image) {
            const filename = imageUrl.split('/').pop()
            if (filename) {
              this.debug('Trying to find by filename', { filename })
              image = document.querySelector(`img[src*="${filename}"]`) as HTMLImageElement
            }
          }
          
          // Method 3: For URLs containing dynamic content (like timestamps), use partial matching
          if (!image) {
            this.debug('Trying partial URL matching')
            const images = document.querySelectorAll('img')
            for (const img of Array.from(images)) {
              if (img.src.includes(imageUrl) || imageUrl.includes(img.src)) {
                image = img as HTMLImageElement
                break
              }
            }
          }
          
          if (!image) {
            throw new Error(`Cannot find image with URL: ${imageUrl}`)
          }
          
          this.debug('Found image element', { src: image.src })
          
          // Now find the input field and submit button at solve time
          const inputElement = this.findRelatedInputField(image)
          if (!inputElement) {
            throw new Error('Input element not found for captcha')
          }

          // Enter the solution
          (inputElement as HTMLInputElement).value = solution.text
          inputElement.dispatchEvent(new Event('input', { bubbles: true }))
          inputElement.dispatchEvent(new Event('change', { bubbles: true }))

          // Try to find and click submit button
          const submitButton = this.findSubmitButton(image, inputElement)
          if (submitButton) {
            setTimeout(() => {
              submitButton.click()
            }, 500)
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