import { twMerge } from 'tailwind-merge'

/**
 * A branded, pixel-art palm-tree loading indicator that sways like a palm in
 * the wind (anchored at the trunk base). Unlike the generic `Spinner`, this is
 * intentionally multi-color — it does not inherit `currentColor`. Size it with
 * w-/h- utilities. The sway keyframes live in app.css (`.animate-palm-sway`).
 */
export function PalmSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      role="status"
      aria-label="Loading"
      className={twMerge('h-8 w-8 animate-palm-sway', className)}
    >
      <rect x="18" y="3" width="4" height="1" fill="#63c74d" />
      <rect x="10" y="4" width="3" height="1" fill="#63c74d" />
      <rect x="17" y="4" width="8" height="1" fill="#63c74d" />
      <rect x="8" y="5" width="6" height="1" fill="#63c74d" />
      <rect x="15" y="5" width="3" height="1" fill="#63c74d" />
      <rect x="18" y="5" width="2" height="1" fill="#669c35" />
      <rect x="20" y="5" width="6" height="1" fill="#63c74d" />
      <rect x="7" y="6" width="10" height="1" fill="#63c74d" />
      <rect x="17" y="6" width="7" height="1" fill="#669c35" />
      <rect x="24" y="6" width="3" height="1" fill="#63c74d" />
      <rect x="6" y="7" width="3" height="1" fill="#63c74d" />
      <rect x="9" y="7" width="1" height="1" fill="#669c35" />
      <rect x="10" y="7" width="6" height="1" fill="#63c74d" />
      <rect x="16" y="7" width="1" height="1" fill="#669c35" />
      <rect x="23" y="7" width="2" height="1" fill="#669c35" />
      <rect x="25" y="7" width="3" height="1" fill="#63c74d" />
      <rect x="5" y="8" width="2" height="1" fill="#63c74d" />
      <rect x="7" y="8" width="2" height="1" fill="#669c35" />
      <rect x="11" y="8" width="11" height="1" fill="#63c74d" />
      <rect x="25" y="8" width="1" height="1" fill="#669c35" />
      <rect x="26" y="8" width="3" height="1" fill="#63c74d" />
      <rect x="4" y="9" width="2" height="1" fill="#63c74d" />
      <rect x="6" y="9" width="2" height="1" fill="#669c35" />
      <rect x="10" y="9" width="3" height="1" fill="#63c74d" />
      <rect x="13" y="9" width="5" height="1" fill="#669c35" />
      <rect x="18" y="9" width="5" height="1" fill="#63c74d" />
      <rect x="26" y="9" width="1" height="1" fill="#669c35" />
      <rect x="27" y="9" width="2" height="1" fill="#63c74d" />
      <rect x="4" y="10" width="1" height="1" fill="#63c74d" />
      <rect x="5" y="10" width="1" height="1" fill="#669c35" />
      <rect x="9" y="10" width="3" height="1" fill="#63c74d" />
      <rect x="12" y="10" width="1" height="1" fill="#669c35" />
      <rect x="14" y="10" width="2" height="1" fill="#9d710d" />
      <rect x="18" y="10" width="1" height="1" fill="#669c35" />
      <rect x="19" y="10" width="5" height="1" fill="#63c74d" />
      <rect x="27" y="10" width="2" height="1" fill="#63c74d" />
      <rect x="4" y="11" width="1" height="1" fill="#63c74d" />
      <rect x="8" y="11" width="4" height="1" fill="#63c74d" />
      <rect x="14" y="11" width="2" height="1" fill="#9d710d" />
      <rect x="16" y="11" width="1" height="1" fill="#c08b0e" />
      <rect x="20" y="11" width="1" height="1" fill="#669c35" />
      <rect x="21" y="11" width="4" height="1" fill="#63c74d" />
      <rect x="27" y="11" width="1" height="1" fill="#63c74d" />
      <rect x="8" y="12" width="4" height="1" fill="#63c74d" />
      <rect x="15" y="12" width="1" height="1" fill="#9d710d" />
      <rect x="16" y="12" width="2" height="1" fill="#c08b0e" />
      <rect x="21" y="12" width="2" height="1" fill="#669c35" />
      <rect x="23" y="12" width="2" height="1" fill="#63c74d" />
      <rect x="8" y="13" width="3" height="1" fill="#63c74d" />
      <rect x="16" y="13" width="1" height="1" fill="#9d710d" />
      <rect x="17" y="13" width="2" height="1" fill="#c08b0e" />
      <rect x="22" y="13" width="2" height="1" fill="#669c35" />
      <rect x="24" y="13" width="2" height="1" fill="#63c74d" />
      <rect x="8" y="14" width="3" height="1" fill="#63c74d" />
      <rect x="15" y="14" width="1" height="1" fill="#c08b0e" />
      <rect x="16" y="14" width="2" height="1" fill="#9d710d" />
      <rect x="22" y="14" width="2" height="1" fill="#669c35" />
      <rect x="24" y="14" width="3" height="1" fill="#63c74d" />
      <rect x="8" y="15" width="3" height="1" fill="#63c74d" />
      <rect x="14" y="15" width="1" height="1" fill="#c08b0e" />
      <rect x="15" y="15" width="2" height="1" fill="#9d710d" />
      <rect x="23" y="15" width="1" height="1" fill="#669c35" />
      <rect x="24" y="15" width="3" height="1" fill="#63c74d" />
      <rect x="9" y="16" width="2" height="1" fill="#63c74d" />
      <rect x="13" y="16" width="2" height="1" fill="#c08b0e" />
      <rect x="15" y="16" width="2" height="1" fill="#9d710d" />
      <rect x="24" y="16" width="1" height="1" fill="#669c35" />
      <rect x="25" y="16" width="2" height="1" fill="#63c74d" />
      <rect x="10" y="17" width="2" height="1" fill="#63c74d" />
      <rect x="15" y="17" width="2" height="1" fill="#9d710d" />
      <rect x="17" y="17" width="2" height="1" fill="#c08b0e" />
      <rect x="25" y="17" width="2" height="1" fill="#63c74d" />
      <rect x="16" y="18" width="2" height="1" fill="#9d710d" />
      <rect x="18" y="18" width="2" height="1" fill="#c08b0e" />
      <rect x="25" y="18" width="2" height="1" fill="#63c74d" />
      <rect x="17" y="19" width="2" height="1" fill="#9d710d" />
      <rect x="19" y="19" width="2" height="1" fill="#c08b0e" />
      <rect x="26" y="19" width="1" height="1" fill="#63c74d" />
      <rect x="16" y="20" width="1" height="1" fill="#c08b0e" />
      <rect x="17" y="20" width="3" height="1" fill="#9d710d" />
      <rect x="20" y="20" width="1" height="1" fill="#c08b0e" />
      <rect x="15" y="21" width="2" height="1" fill="#c08b0e" />
      <rect x="17" y="21" width="3" height="1" fill="#9d710d" />
      <rect x="13" y="22" width="3" height="1" fill="#c08b0e" />
      <rect x="16" y="22" width="3" height="1" fill="#9d710d" />
      <rect x="12" y="23" width="3" height="1" fill="#c08b0e" />
      <rect x="15" y="23" width="3" height="1" fill="#9d710d" />
      <rect x="11" y="24" width="3" height="1" fill="#c08b0e" />
      <rect x="14" y="24" width="3" height="1" fill="#9d710d" />
      <rect x="10" y="25" width="3" height="1" fill="#c08b0e" />
      <rect x="13" y="25" width="3" height="1" fill="#9d710d" />
      <rect x="9" y="26" width="4" height="1" fill="#c08b0e" />
      <rect x="13" y="26" width="2" height="1" fill="#9d710d" />
      <rect x="8" y="27" width="4" height="1" fill="#c08b0e" />
      <rect x="12" y="27" width="4" height="1" fill="#9d710d" />
      <rect x="8" y="28" width="3" height="1" fill="#c08b0e" />
      <rect x="11" y="28" width="6" height="1" fill="#9d710d" />
    </svg>
  )
}
