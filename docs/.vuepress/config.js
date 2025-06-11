import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { mdEnhancePlugin } from "vuepress-plugin-md-enhance";

export default defineUserConfig({
  lang: 'en-US',

  title: 'Throttr — Sovereign Real-Time Data & Messaging Engine',
  description: 'The limit is set by your machine and your architecture.',

  theme: defaultTheme({
    logo: '/images/logo.png',

    navbar: ['/', '/get-started', '/about-protocol', '/about-server'],

    sidebarDepth: 5,
  }),

  plugins: [
    mdEnhancePlugin({
      mermaid: true,
    })
  ],

  bundler: viteBundler(),
})
