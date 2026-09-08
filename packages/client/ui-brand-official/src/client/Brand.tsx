import { BrandWordmark, FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  const configured = process.env.DSH_CLIENT_ICON_URL?.trim()
  return configured === undefined || configured === ''
    ? <FishLogo size={size} />
    : <img src={configured} width={size} height={size} alt="" />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  const configured = process.env.DSH_CLIENT_TITLE?.trim()
  return configured === undefined || configured === '' || configured === 'DeepSeek Harness'
    ? <BrandWordmark includeMark={false} />
    : <span>{configured}</span>
}
