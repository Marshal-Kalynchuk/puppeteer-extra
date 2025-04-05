import test from 'ava'

import { getBrowser } from '../common/detection.test'
import { getBrowser as getSolveBrowser, requiresApiKey } from '../common/solving.test'

// Detection tests
test('hcaptcha: will detect in demo page', async t => {
  const url = 'https://accounts.hcaptcha.com/demo'
  const { browser, page } = await getBrowser(url)
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)

  const c = captchas[0]
  t.is(c._vendor, 'hcaptcha')
  t.is(c.url, url)
  t.true(c.sitekey && c.sitekey.length > 5)

  await browser.close()
})

test('hcaptcha: will detect in democaptcha.com page', async t => {
  const url = 'https://democaptcha.com/demo-form-eng/hcaptcha.html'
  const { browser, page } = await getBrowser(url)
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)

  const c = captchas[0]
  t.is(c._vendor, 'hcaptcha')
  t.is(c.url, url)
  t.true(c.sitekey && c.sitekey.length > 5)

  await browser.close()
})

test('hcaptcha: will detect active hCAPTCHA challenges', async t => {
  const url = 'https://accounts.hcaptcha.com/demo'
  const { browser, page } = await getBrowser(url)
  
  await page.evaluate(() => (window as any).hcaptcha.execute()) // trigger challenge popup
  await page.waitForTimeout(2 * 1000)
  await page.evaluate(() =>
    document
      .querySelector(`[data-hcaptcha-widget-id]:not([src*='invisible'])`)
      .remove()
  ) // remove regular checkbox so we definitely test against the popup

  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)

  const c = captchas[0]
  t.is(c._vendor, 'hcaptcha')
  t.is(c.url, url)
  t.true(c.sitekey && c.sitekey.length > 5)

  await browser.close()
})

// Solving tests
test('hcaptcha: will solve hCAPTCHAs', async t => {
  if (requiresApiKey(t)) return

  const urls = [
    'https://accounts.hcaptcha.com/demo',
    'http://democaptcha.com/demo-form-eng/hcaptcha.html',
  ]

  for (const url of urls) {
    const { browser, page } = await getSolveBrowser(url)

    const result = await (page as any).solveRecaptchas()
    const { captchas, solutions, solved, error } = result
    t.falsy(error)

    t.is(captchas.length, 1)
    t.is(solutions.length, 1)
    t.is(solved.length, 1)
    t.is(solved[0]._vendor, 'hcaptcha')
    t.is(solved[0].isSolved, true)
    
    await browser.close()
  }
}) 