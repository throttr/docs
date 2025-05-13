import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  lang: 'en-US',

  title: 'Throttr — Sovereign Rate Limiter',
  description: 'The limit is set by your machine.',

  theme: defaultTheme({
    logo: '/images/logo.png',

    navbar: ['/', '/get-started', '/about-protocol'],
  }),

  bundler: viteBundler(),
})
