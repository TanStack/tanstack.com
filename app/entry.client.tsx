import { sharedTwindConfig } from '../twind.shared'
setup(sharedTwindConfig)
import { hydrate } from 'react-dom'
import { RemixBrowser } from 'remix'

import { setup } from 'twind'

hydrate(<RemixBrowser />, document)
