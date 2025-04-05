import test from 'ava'

import RecaptchaPlugin from '../../src/index'
import { addExtra } from 'puppeteer-extra'

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

export const getBrowser = async (url = '', opts = {}) => {
  const puppeteer = addExtra(require('puppeteer'))
  const recaptchaPlugin = RecaptchaPlugin(opts)
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

test('will not throw when no captchas are found', async t => {
  const url = 'https://www.example.com'
  const { browser, page } = await getBrowser(url)
  const { captchas, error } = await (page as any).findRecaptchas()
  t.is(error, null)
  t.is(captchas.length, 0)
  await browser.close()
}) 