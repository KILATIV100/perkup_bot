export type LocationFormat = 'SELF_SERVICE' | 'INFO_MENU_ONLY' | 'TO_GO' | 'FAMILY_CAFE'
export type PosSystem = 'NONE' | 'POSTER'
export type MenuManagement = 'LOCAL' | 'POSTER_SYNC'

interface BaseLocationProfile {
  format: LocationFormat
  posSystem: PosSystem
  menuManagement: MenuManagement
  paymentFlow: 'CASHIER_ONLY' | 'NONE'
  remoteOrderingEnabled: boolean
}

interface LocationProfileSource {
  slug: string
  allowOrders?: boolean
  hasPoster?: boolean
}

const LOCATION_PROFILE_MAP: Record<string, Omit<BaseLocationProfile, 'remoteOrderingEnabled'>> = {
  'mark-mall': {
    format: 'INFO_MENU_ONLY',
    posSystem: 'NONE',
    menuManagement: 'LOCAL',
    paymentFlow: 'NONE',
  },
  krona: {
    format: 'FAMILY_CAFE',
    posSystem: 'POSTER',
    menuManagement: 'POSTER_SYNC',
    paymentFlow: 'CASHIER_ONLY',
  },
  pryozerny: {
    format: 'TO_GO',
    posSystem: 'POSTER',
    menuManagement: 'POSTER_SYNC',
    paymentFlow: 'CASHIER_ONLY',
  },
}

export function getLocationProfile(location: LocationProfileSource): BaseLocationProfile {
  const mapped = LOCATION_PROFILE_MAP[location.slug]
  if (mapped) {
    return {
      ...mapped,
      remoteOrderingEnabled: Boolean(location.allowOrders),
    }
  }

  return {
    format: location.hasPoster ? 'TO_GO' : 'SELF_SERVICE',
    posSystem: location.hasPoster ? 'POSTER' : 'NONE',
    menuManagement: location.hasPoster ? 'POSTER_SYNC' : 'LOCAL',
    paymentFlow: 'CASHIER_ONLY',
    remoteOrderingEnabled: Boolean(location.allowOrders),
  }
}
