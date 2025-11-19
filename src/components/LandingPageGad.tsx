import { GamFooter } from './Gam'
import { AdGate } from '~/contexts/AdsContext'

export default function LandingPageGad() {
  return (
    <AdGate>
      <div className={`lg:max-[400px] px-4 mx-auto flex justify-center`}>
        <GamFooter />
      </div>
    </AdGate>
  )
}
