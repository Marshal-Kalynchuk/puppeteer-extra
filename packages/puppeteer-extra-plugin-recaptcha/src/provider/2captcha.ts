export const PROVIDER_ID = '2captcha'
import * as types from '../types'

import Debug from 'debug'
const debug = Debug(`puppeteer-extra-plugin:recaptcha:${PROVIDER_ID}`)

// const solver = require('./2captcha-api')
import * as solver from './2captcha-api'

const secondsBetweenDates = (before: Date, after: Date) =>
  (after.getTime() - before.getTime()) / 1000

export interface DecodeRecaptchaAsyncResult {
  err?: any
  result?: any
  invalid?: any
}

export interface TwoCaptchaProviderOpts {
  useEnterpriseFlag?: boolean
  useActionValue?: boolean
  proxy?: {
    server: string       // 'http://username:password@ip:port' or 'http://ip:port'
    username?: string    // optional
    password?: string    // optional
  }
}

const providerOptsDefaults: TwoCaptchaProviderOpts = {
  useEnterpriseFlag: false, // Seems to make solving chance worse?
  useActionValue: true
  // proxy is undefined by default
}

/**
 * Normalize proxy configuration to 2captcha format
 * @param proxy - Proxy configuration object
 * @returns Object with proxytype and proxy address for 2captcha API
 */
function normalizeProxy(proxy?: TwoCaptchaProviderOpts['proxy']): { proxytype?: string, proxy?: string } {
  if (!proxy || !proxy.server) {
    return {}
  }

  // Parse the URL to extract protocol, host, port
  let url: URL
  try {
    // Add http:// prefix if missing to make URL parsing work
    const serverUrl = proxy.server.includes('://') ? proxy.server : `http://${proxy.server}`
    url = new URL(serverUrl)
  } catch (err) {
    console.warn('Invalid proxy server URL format:', proxy.server)
    return {}
  }

  // Determine proxy type from protocol
  const proxytype = url.protocol.replace(':', '').toUpperCase()
  
  // Build proxy string
  let proxyStr = ''
  
  // Add username/password if provided directly in options (overrides URL auth)
  if (proxy.username) {
    proxyStr += proxy.username
    if (proxy.password) {
      proxyStr += `:${proxy.password}`
    }
    proxyStr += '@'
  }
  // Otherwise use auth from URL if available
  else if (url.username) {
    proxyStr += url.username
    if (url.password) {
      proxyStr += `:${url.password}`
    }
    proxyStr += '@'
  }
  
  // Add host and port
  proxyStr += url.host
  
  return {
    proxytype,
    proxy: proxyStr
  }
}

async function decodeRecaptchaAsync(
  token: string,
  vendor: types.CaptchaVendor,
  sitekey: string,
  url: string,
  extraData: any,
  opts = { pollingInterval: 2000 }
): Promise<DecodeRecaptchaAsyncResult> {
  return new Promise(resolve => {
    const cb = (err: any, result: any, invalid: any) =>
      resolve({ err, result, invalid })
    try {
      solver.setApiKey(token)

      let method = 'userrecaptcha'
      if (vendor === 'hcaptcha') {
        method = 'hcaptcha'
      }
      solver.decodeReCaptcha(method, sitekey, url, extraData, opts, cb)
    } catch (error) {
      return resolve({ err: error })
    }
  })
}

async function decodeImageAsync(
  token: string,
  imageBase64: string,
  opts = { pollingInterval: 2000 }
): Promise<DecodeRecaptchaAsyncResult> {
  return new Promise(resolve => {
    const cb = (err: any, result: any, invalid: any) =>
      resolve({ err, result, invalid })
    try {
      solver.setApiKey(token)
      solver.decode(imageBase64, opts, cb)
    } catch (error) {
      return resolve({ err: error })
    }
  })
}

export async function getSolutions(
  captchas: types.CaptchaInfo[] = [],
  token: string = '',
  opts: TwoCaptchaProviderOpts = {}
): Promise<types.GetSolutionsResult> {
  opts = { ...providerOptsDefaults, ...opts }
  const solutions = await Promise.all(
    captchas.map(c => getSolution(c, token, opts))
  )
  return { solutions, error: solutions.find(s => !!s.error) }
}

async function getSolution(
  captcha: types.CaptchaInfo,
  token: string,
  opts: TwoCaptchaProviderOpts
): Promise<types.CaptchaSolution> {
  const solution: types.CaptchaSolution = {
    _vendor: captcha._vendor,
    provider: PROVIDER_ID
  }
  try {
    if (!captcha || !captcha.id) {
      throw new Error('Missing data in captcha')
    }
    
    solution.id = captcha.id
    solution.requestAt = new Date()
    debug('Requesting solution..', solution)
    
    // Handle different captcha types
    if (captcha._vendor === 'image') {
      // For image captchas
      if (!captcha.imageBase64 && !captcha.imageUrl) {
        throw new Error('Missing image data for image captcha')
      }
      
      let imageBase64 = captcha.imageBase64
      
      // If we only have URL but not base64, we need to skip
      if (!imageBase64) {
        throw new Error('Base64 image data is required for 2captcha provider')
      }
      
      // If the imageBase64 includes a data URI prefix, remove it
      if (imageBase64.startsWith('data:image')) {
        imageBase64 = imageBase64.split(',')[1]
      }
      
      const { err, result, invalid } = await decodeImageAsync(
        token,
        imageBase64
      )
      
      debug('Got response (image)', { err, result, invalid })
      if (err) throw new Error(`${PROVIDER_ID} error (image): ${err}`)
      if (!result || !result.text || !result.id) {
        throw new Error(`${PROVIDER_ID} error (image): Missing response data: ${result}`)
      }
      
      solution.providerCaptchaId = result.id
      solution.text = result.text
      solution.imageUrl = captcha.imageUrl
      solution.responseAt = new Date()
      solution.hasSolution = !!solution.text
      solution.duration = secondsBetweenDates(
        solution.requestAt,
        solution.responseAt
      )
    } else {
      // For recaptcha/hcaptcha
      if (!captcha.sitekey || !captcha.url) {
        throw new Error('Missing data in captcha')
      }
      
      const extraData = {}
      if (captcha.s) {
        extraData['data-s'] = captcha.s // google site specific property
      }
      if (opts.useActionValue && captcha.action) {
        extraData['action'] = captcha.action // Optional v3/enterprise action
      }
      if (opts.useEnterpriseFlag && captcha.isEnterprise) {
        extraData['enterprise'] = 1
      }
      
      // Handle proxy configuration
      const proxyConfig = normalizeProxy(opts.proxy)
      if (proxyConfig.proxytype && proxyConfig.proxy) {
        extraData['proxytype'] = proxyConfig.proxytype
        extraData['proxy'] = proxyConfig.proxy
      } else if (process.env['2CAPTCHA_PROXY_TYPE'] && process.env['2CAPTCHA_PROXY_ADDRESS']) {
        // Maintain backward compatibility with environment variables
        extraData['proxytype'] = process.env['2CAPTCHA_PROXY_TYPE'].toUpperCase()
        extraData['proxy'] = process.env['2CAPTCHA_PROXY_ADDRESS']
      }
        
      const { err, result, invalid } = await decodeRecaptchaAsync(
        token,
        captcha._vendor,
        captcha.sitekey,
        captcha.url,
        extraData
      )
      debug('Got response', { err, result, invalid })
      if (err) throw new Error(`${PROVIDER_ID} error: ${err}`)
      if (!result || !result.text || !result.id) {
        throw new Error(`${PROVIDER_ID} error: Missing response data: ${result}`)
      }
      
      solution.providerCaptchaId = result.id
      solution.text = result.text
      solution.responseAt = new Date()
      solution.hasSolution = !!solution.text
      solution.duration = secondsBetweenDates(
        solution.requestAt,
        solution.responseAt
      )
    }
  } catch (error) {
    debug('Error', error)
    solution.error = error.toString()
  }
  return solution
}
