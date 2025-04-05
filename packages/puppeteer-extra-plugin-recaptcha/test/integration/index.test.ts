import test from 'ava'

import RecaptchaPlugin from '../../src/index'
import { addExtra } from 'puppeteer-extra'

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

test('integration: plugin is properly initialized', t => {
  const plugin = RecaptchaPlugin()
  t.is(plugin.name, 'recaptcha')
})

test('integration: plugin has the correct defaults', t => {
  const plugin = RecaptchaPlugin()
  const defaults = plugin.defaults
  
  t.is(defaults.visualFeedback, true)
  t.is(defaults.throwOnError, false)
  t.is(defaults.solveInViewportOnly, false)
  t.is(defaults.solveScoreBased, false)
  t.is(defaults.solveInactiveChallenges, false)
  t.is(defaults.solveImageCaptchas, false)
})

test('integration: plugin adds methods to page', async t => {
  const puppeteer = addExtra(require('puppeteer'))
  const recaptchaPlugin = RecaptchaPlugin()
  puppeteer.use(recaptchaPlugin)

  const browser = await puppeteer.launch({
    args: PUPPETEER_ARGS,
    headless: true
  })
  const page = await browser.newPage()

  // Check if the plugin methods were properly added to the page
  t.true(typeof (page as any).findRecaptchas === 'function')
  t.true(typeof (page as any).getRecaptchaSolutions === 'function') 
  t.true(typeof (page as any).enterRecaptchaSolutions === 'function')
  t.true(typeof (page as any).solveRecaptchas === 'function')

  await browser.close()
})

test('integration: plugin works with framed content', async t => {
  const puppeteer = addExtra(require('puppeteer'))
  const recaptchaPlugin = RecaptchaPlugin()
  puppeteer.use(recaptchaPlugin)

  const browser = await puppeteer.launch({
    args: PUPPETEER_ARGS,
    headless: true
  })
  
  // Test that methods are added to frames
  const page = await browser.newPage()
  await page.goto('about:blank')
  
  // Create a frame
  await page.evaluate(() => {
    const iframe = document.createElement('iframe')
    iframe.src = 'about:blank'
    document.body.appendChild(iframe)
  })
  
  // Wait for frame to load
  await page.waitForTimeout(1000)
  
  const frames = page.frames()
  t.true(frames.length > 1)
  
  const childFrame = frames[1]
  
  // Check if the plugin methods were properly added to the frame
  t.true(typeof (childFrame as any).findRecaptchas === 'function')
  t.true(typeof (childFrame as any).solveRecaptchas === 'function')

  await browser.close()
})

test('integration: supports different captcha types simultaneously', async t => {
  const puppeteer = addExtra(require('puppeteer'))
  const recaptchaPlugin = RecaptchaPlugin({
    solveScoreBased: true,
    solveInactiveChallenges: true,
    solveImageCaptchas: true
  })
  puppeteer.use(recaptchaPlugin)

  const browser = await puppeteer.launch({
    args: PUPPETEER_ARGS,
    headless: true
  })
  
  const page = await browser.newPage()
  
  // Create a test page with multiple captcha types
  await page.setContent(`
    <html>
      <body>
        <div id="g-recaptcha" class="g-recaptcha" data-sitekey="6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-"></div>
        <div id="h-captcha" class="h-captcha" data-sitekey="10000000-ffff-ffff-ffff-000000000001"></div>
        <img src="https://example.com/captcha.jpg" alt="captcha">
        <input type="text" name="captcha" placeholder="Enter captcha">
        <script>
          window.___grecaptcha_cfg = { clients: { 0: {} } }
          window.hcaptcha = { render: function(){} }
        </script>
      </body>
    </html>
  `)
  
  // Mock the evaluate function
  const originalEvaluate = page.evaluate
  page.evaluate = async function(fn) {
    if (typeof fn === 'string' && fn.includes('findRecaptchas')) {
      if (fn.includes('RecaptchaContentScript')) {
        return { 
          captchas: [{ _vendor: 'recaptcha', id: 'recaptcha-123', sitekey: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-' }],
          error: null 
        }
      } else if (fn.includes('HcaptchaContentScript')) {
        return { 
          captchas: [{ _vendor: 'hcaptcha', id: 'hcaptcha-123', sitekey: '10000000-ffff-ffff-ffff-000000000001' }],
          error: null 
        }
      } else if (fn.includes('ImageCaptchaContentScript')) {
        return { 
          captchas: [{ _vendor: 'image', id: 'image-123', imageUrl: 'https://example.com/captcha.jpg' }],
          error: null 
        }
      }
    }
    return originalEvaluate.apply(this, arguments)
  }
  
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 3)
  
  // Verify we have one of each captcha type
  const captchaTypes = captchas.map(c => c._vendor)
  t.true(captchaTypes.includes('recaptcha'))
  t.true(captchaTypes.includes('hcaptcha'))
  t.true(captchaTypes.includes('image'))

  await browser.close()
}) 