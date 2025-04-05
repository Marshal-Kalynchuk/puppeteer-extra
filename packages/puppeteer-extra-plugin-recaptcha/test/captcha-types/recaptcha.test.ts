import test from 'ava'

import { getBrowser } from '../common/detection.test'
import { getBrowser as getSolveBrowser, requiresApiKey } from '../common/solving.test'

// Detection tests
test('recaptcha: will detect v2-checkbox-auto.html', async t => {
  const url = 'https://berstend.github.io/static/recaptcha/v2-checkbox-auto.html'
  const { browser, page } = await getBrowser(url)
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)

  const c = captchas[0]
  t.is(c._vendor, 'recaptcha')
  t.is(c._type, 'checkbox')
  t.is(c.url, url)

  t.true(c.sitekey && c.sitekey.length > 5)
  t.is(c.widgetId, 0)
  t.not(c.display, undefined)
  t.is(c.callback, undefined)

  t.is(c.hasResponseElement, true)
  t.is(c.isEnterprise, false)
  t.is(c.isInViewport, true)
  t.is(c.isInvisible, false)

  await browser.close()
})

test('recaptcha: will detect enterprise-checkbox-auto.html', async t => {
  const url = 'https://berstend.github.io/static/recaptcha/enterprise-checkbox-auto.html'
  const { browser, page } = await getBrowser(url)
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)

  const c = captchas[0]
  t.is(c._vendor, 'recaptcha')
  t.is(c.callback, undefined)
  t.is(c.isEnterprise, true)
  t.is(c.hasResponseElement, true)
  t.is(c.url, url)
  t.true(c.sitekey && c.sitekey.length > 5)
  t.is(c.widgetId, 0)
  t.not(c.display, undefined)

  await browser.close()
})

test('recaptcha: will detect v3-programmatic.html with solveScoreBased:true', async t => {
  const url = 'https://berstend.github.io/static/recaptcha/v3-programmatic.html'
  const { browser, page } = await getBrowser(url, {
    solveScoreBased: true
  })
  const { captchas, filtered, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 1)
  t.is(filtered.length, 0)

  const c = captchas[0]
  t.is(c.url, url)
  t.true(c.sitekey && c.sitekey.length > 5)
  t.not(c.display, undefined)
  t.not(c.id, undefined)

  delete c.url
  delete c.sitekey
  delete c.display
  delete c.id

  t.deepEqual(c, {
    _vendor: 'recaptcha',
    s: null,
    widgetId: 100000,
    hasResponseElement: true,
    isEnterprise: false,
    isInViewport: true,
    isInvisible: true,
    _type: 'score',
    hasActiveChallengePopup: false,
    hasChallengeFrame: false // important
  })

  await browser.close()
})

// Solving tests
test('recaptcha: will solve reCAPTCHAs', async t => {
  if (requiresApiKey(t)) return

  const url = 'https://www.google.com/recaptcha/api2/demo'
  const { browser, page } = await getSolveBrowser(url)

  const result = await (page as any).solveRecaptchas()

  const { captchas, solutions, solved, error } = result
  t.falsy(error)

  t.is(captchas.length, 1)
  t.is(solutions.length, 1)
  t.is(solved.length, 1)
  t.is(solved[0]._vendor, 'recaptcha')
  t.is(solved[0].isSolved, true)

  await browser.close()
})

test('recaptcha: will solve reCAPTCHA enterprise', async t => {
  if (requiresApiKey(t)) return

  const url = 'https://berstend.github.io/static/recaptcha/enterprise-checkbox-explicit.html'
  const { browser, page } = await getSolveBrowser(url, {
    provider: {
      id: '2captcha',
      token: process.env.TWOCAPTCHA_TOKEN,
      opts: {
        useEnterpriseFlag: false
      }
    }
  })

  const result = await (page as any).solveRecaptchas()

  const { captchas, solutions, solved, error } = result
  t.falsy(error)

  t.is(captchas.length, 1)
  t.is(solutions.length, 1)
  t.is(solved.length, 1)
  t.is(solved[0]._vendor, 'recaptcha')
  t.is(solved[0].isSolved, true)

  await browser.close()
}) 