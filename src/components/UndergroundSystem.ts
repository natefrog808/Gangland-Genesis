import { defineComponent, defineQuery, Types } from 'bitecs'

// Shadow economy tracking - using bit manipulation for performance
const UndergroundEconomy = defineComponent({
  marketAccess: Types.ui32,      // Bitfield of accessible black markets
  contraband: [Types.ui16, 8],   // Illegal resource quantities
  contacts: Types.ui32,          // Network of underground contacts
  reputation: Types.f32,         // Standing in shadow economy
  heatLevel: Types.f32,         // Attention from authorities
  fronts: [Types.ui8, 4]        // Cover businesses
})

// Market network node
const BlackMarket = defineComponent({
  resources: [Types.ui16, 8],    // Available contraband
  operators: Types.ui32,         // Who runs this market
  customers: Types.ui32,         // Regular customers
  security: Types.f32,          // How well hidden it is
  prices: [Types.f32, 8],       // Current black market rates
  specialties: Types.ui8        // What this market is known for
})

class UndergroundSystem {
  private readonly HEAT_THRESHOLD = 0.7
  private readonly MAX_MARKETS = 32 // Fits in ui32 bitfield
  
  constructor(world) {
    this.world = world
    this.operators = defineQuery([
      UndergroundEconomy,
      EconomicState,
      ConspiracyState
    ])
    // Track active markets efficiently
    this.activeMarkets = new Set()
    // Cache for market discovery calculations
    this.discoveryCache = new Map()
  }

  update() {
    const operators = this.operators(this.world)
    
    // Update markets first
    this.updateBlackMarkets()
    
    // Then handle operator actions
    for (const operator of operators) {
      const underground = UndergroundEconomy.get(operator)
      const economic = EconomicState.get(operator)
      
      // Check if we need to engage with black market
      if (this.needsBlackMarket(operator, economic)) {
        this.engageUnderground(operator, underground, economic)
      }
      
      // Manage heat level
      this.manageHeatLevel(operator, underground)
      
      // Update networks
      this.maintainUndergroundNetwork(operator, underground)
    }
    
    // Clean up exposed markets
    this.cleanupCompromisedMarkets()
  }

  private updateBlackMarkets() {
    for (const marketId of this.activeMarkets) {
      const market = BlackMarket.get(marketId)
      
      // Update prices based on supply/demand
      this.updateMarketPrices(market)
      
      // Check for law enforcement attention
      if (this.isMarketCompromised(market)) {
        this.handleMarketRaid(marketId, market)
      } else {
        // Normal market operations
        this.processMarketTransactions(marketId, market)
      }
    }
  }

  private needsBlackMarket(operator, economic) {
    // Check if regular economy is too restrictive
    const restrictions = this.calculateEconomicPressure(economic)
    
    // Check if resources are scarce
    const scarcity = this.checkResourceScarcity(economic)
    
    // Check if prices are too high in regular market
    const priceGouging = this.detectPriceGouging(economic)
    
    return restrictions > 0.6 || scarcity > 0.7 || priceGouging
  }

  private engageUnderground(operator, underground, economic) {
    // Find or create suitable market
    const market = this.findSuitableMarket(operator, underground)
    
    if (market) {
      // Attempt to trade
      this.executeUndergroundTrade(operator, market, underground, economic)
    } else {
      // Consider establishing new market
      this.considerNewMarket(operator, underground)
    }
  }

  private findSuitableMarket(operator, underground) {
    const cacheKey = `${operator}_${underground.marketAccess}`
    
    // Check cache first
    if (this.discoveryCache.has(cacheKey)) {
      const cached = this.discoveryCache.get(cacheKey)
      if (cached.timestamp > this.world.time - 100) {
        return cached.market
      }
    }
    
    // Find market through contacts
    let bestMarket = null
    let bestScore = 0
    
    for (const marketId of this.activeMarkets) {
      if (underground.marketAccess & (1 << marketId)) {
        const score = this.evaluateMarketSuitability(marketId, operator)
        if (score > bestScore) {
          bestScore = score
          bestMarket = marketId
        }
      }
    }
    
    // Cache result
    this.discoveryCache.set(cacheKey, {
      market: bestMarket,
      timestamp: this.world.time
    })
    
    return bestMarket
  }

  private executeUndergroundTrade(operator, marketId, underground, economic) {
    const market = BlackMarket.get(marketId)
    
    // Calculate safe trade volume
    const volume = this.calculateSafeTradeVolume(underground, market)
    
    // Execute trade if worth the risk
    if (this.isTradeWorthRisk(volume, market.prices)) {
      this.processTrade(operator, marketId, volume)
      
      // Update heat levels
      underground.heatLevel += volume * 0.1
      market.security -= volume * 0.05
    }
  }

  private manageHeatLevel(operator, underground) {
    // Natural heat decay
    underground.heatLevel *= 0.95
    
    // Check for investigations
    if (underground.heatLevel > this.HEAT_THRESHOLD) {
      this.handleInvestigation(operator, underground)
    }
    
    // Attempt to reduce heat
    if (underground.heatLevel > 0.4) {
      this.reduceHeat(operator, underground)
    }
  }

  private handleInvestigation(operator, underground) {
    // Remove compromised contacts
    underground.contacts &= ~this.findCompromisedContacts(underground)
    
    // Burn exposed markets
    let newAccess = underground.marketAccess
    for (let i = 0; i < this.MAX_MARKETS; i++) {
      if (newAccess & (1 << i)) {
        if (this.isMarketCompromised(BlackMarket.get(i))) {
          newAccess &= ~(1 << i)
        }
      }
    }
    underground.marketAccess = newAccess
    
    // Switch front businesses if needed
    this.rotateFrontBusinesses(operator, underground)
  }

  private reduceHeat(operator, underground) {
    // Use front businesses
    for (const front of underground.fronts) {
      if (front !== 0) {
        underground.heatLevel -= 0.1
      }
    }
    
    // Bribe officials (costs resources)
    const economic = EconomicState.get(operator)
    if (economic.resources[0] > 100) {
      economic.resources[0] -= 100
      underground.heatLevel -= 0.2
    }
    
    // Cut ties with risky contacts
    const riskyContacts = this.identifyRiskyContacts(underground)
    underground.contacts &= ~riskyContacts
  }

  private maintainUndergroundNetwork(operator, underground) {
    // Find new contacts
    if (this.countBits(underground.contacts) < 8) {
      this.seekNewContacts(operator, underground)
    }
    
    // Maintain front businesses
    this.updateFronts(operator, underground)
    
    // Update market knowledge
    this.gatherMarketIntel(operator, underground)
  }

  private seekNewContacts(operator, underground) {
    const conspiracy = ConspiracyState.get(operator)
    const potentialContacts = this.findPotentialContacts(conspiracy)
    
    for (const contact of potentialContacts) {
      if (this.canTrust(operator, contact)) {
        underground.contacts |= (1 << contact)
        // Maybe learn about new markets
        this.learnMarketsFromContact(underground, contact)
      }
    }
  }

  private updateFronts(operator, underground) {
    for (let i = 0; i < underground.fronts.length; i++) {
      const front = underground.fronts[i]
      if (front !== 0) {
        // Check if front is still viable
        if (this.isFrontCompromised(front)) {
          // Replace with new front if possible
          underground.fronts[i] = this.establishNewFront(operator)
        }
      }
    }
  }
}

export { UndergroundEconomy, BlackMarket, UndergroundSystem }
