import assert from 'node:assert/strict'
import test from 'node:test'
import { redirectInsecureSiteRequest } from '../src/utils/http'

test('HTTP site requests reach HTTPS before browser crypto code runs', () => {
  for (const method of ['GET', 'HEAD', 'POST']) {
    const response = redirectInsecureSiteRequest(
      new Request(
        'http://tanstack.com/query/latest/docs/framework/react/overview?search=a%2Fb&returnTo=%2Fdocs',
        { method },
      ),
    )
    assert.ok(response)
    assert.equal(response.status, 308)
    assert.equal(
      response.headers.get('Location'),
      'https://tanstack.com/query/latest/docs/framework/react/overview?search=a%2Fb&returnTo=%2Fdocs',
    )
    assert.equal(response.body, null)
  }
})

test('HTTPS and other hosts retain their own routing', () => {
  for (const url of [
    'https://tanstack.com/',
    'http://localhost:3000/query/latest/docs/framework/react/overview',
    'http://127.0.0.1:3000/',
    'http://preview.example.com/',
    'http://chat.tanstack.com/',
    'http://tanstack.com.attacker.test/',
    'http://tanstack.com:8080/',
  ]) {
    assert.equal(redirectInsecureSiteRequest(new Request(url)), undefined, url)
  }
})
