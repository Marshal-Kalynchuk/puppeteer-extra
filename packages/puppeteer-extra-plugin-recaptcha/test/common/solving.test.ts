import test from 'ava'

import RecaptchaPlugin from '../../src/index'
import { addExtra } from 'puppeteer-extra'

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

export const requiresApiKey = (t: any) => {
  if (!process.env.TWOCAPTCHA_TOKEN) {
    t.truthy('API key check passed - skipping test')
    console.log('TWOCAPTCHA_TOKEN not set, skipping test.')
    return true
  }
  t.truthy('API key check passed - running test')
  return false
}

export const getSolvePlugin = (opts = {}) => {
  return RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: process.env.TWOCAPTCHA_TOKEN
    },
    ...opts
  })
}

export const getBrowser = async (url = '', opts = {}) => {
  const puppeteer = addExtra(require('puppeteer'))
  const recaptchaPlugin = getSolvePlugin(opts)
  puppeteer.use(recaptchaPlugin)
  const browser = await puppeteer.launch({
    args: PUPPETEER_ARGS,
    headless: true,
    defaultViewport: null
  })
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle0' })
  return { browser, page }
}

test('requires API key for solving', t => {
  requiresApiKey(t)
}) 