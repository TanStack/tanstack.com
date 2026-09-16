import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { BuilderSharedChatWelcome } from '../src/components/builder/BuilderSharedChatWelcome'

test('shared chat explains the missing history and how to save changes without posing as a message', () => {
  const $ = load(renderToStaticMarkup(createElement(BuilderSharedChatWelcome)))
  assert.equal($('h2').text(), 'What would you like to change?')
  assert.match($('p').text(), /creator’s chat isn’t shared/)
  assert.match($('p').text(), /fork to save your changes/)
  assert.equal($('article, button, textarea').length, 0)
})
