export function render() {
  throw new Error(
    'EJS template rendering is not supported in the Cloudflare Workers runtime.',
  )
}

export default { render }
