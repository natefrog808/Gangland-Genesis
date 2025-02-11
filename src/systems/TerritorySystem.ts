import { defineComponent, defineQuery, Types } from 'bitecs'

// Territory control tracking
const TerritoryControl = defineComponent({
  territories: Types.ui32,        // Bitfield of controlled areas
  protection: [Types.ui8, 16],    // Protection level in each area
  income: [Types.ui16, 16],       // Revenue from each territory
  enforcers: Types.ui32,         // Muscle backing territorial claims
  rivals: Types.ui32,            // Active territorial disputes
  stability: [Types.f32, 16]     // Control stability in each area
})

// Gang warfare tracking
const WarfareState = defineComponent({
  activeConflicts: Types.ui32,    // Bitfield of current wars
  warStrength: Types.f32,        // Current fighting capability
  allies: Types.ui32,            // Allied gangs
  casualties: Types.ui16,        // Recent losses
  victories: Types.ui16,         // Recent wins
  reputation: Types.f32          // Street cred/fear factor
})

class TerritorySystem {
  private readonly TERRITORY_GRID = 16 // 4x4 grid of territories
  private readonly MIN_STRENGTH = 0.3  // Minimum strength to hold territory
  
  constructor(world) {
    this.world = world
    this.gangsters = defineQuery([
      TerritoryControl, 
      WarfareState,
      UndergroundEconomy
    ])
    // Spatial partitioning for territory conflicts
    this.territoryGrid = new Array(this.TERRITORY_GRID)
    this.conflictCache = new Map()
  }

  update() {
    const gangsters = this.gangsters(this.world)
    
    // Update territory control first
    this.updateTerritories()
    
    // Then handle active conflicts
    this.resolveConflicts()
    
    // Finally process individual gang actions
    for (const gangster of gangsters) {
      const territory = TerritoryControl.get(gangster)
      const warfare = WarfareState.get(gangster)
      
      // Consider territorial expansion
      if (this.shouldExpand(territory, warfare)) {
        this.planExpansion(gangster, territory, warfare)
      }
      
      // Handle ongoing wars
      if (warfare.activeConflicts) {
        this.manageConflicts(gangster, territory, warfare)
      }
      
      // Maintain territory control
      this.maintainControl(gangster, territory, warfare)
    }
  }

  private updateTerritories() {
    // Clear spatial partitioning grid
    this.territoryGrid.fill(null)
    
    // Update territory control and detect conflicts
    const gangsters = this.gangsters(this.world)
    for (const gangster of gangsters) {
      const territory = TerritoryControl.get(gangster)
      
      // Map territories to grid cells
      for (let i = 0; i < this.TERRITORY_GRID; i++) {
        if (territory.territories & (1 << i)) {
          if (this.territoryGrid[i]) {
            // Conflict detected
            this.registerConflict(
              gangster, 
              this.territoryGrid[i], 
              i
            )
          } else {
            this.territoryGrid[i] = gangster
          }
        }
      }
    }
  }

  private registerConflict(gang1, gang2, territoryId) {
    const conflictKey = `${Math.min(gang1, gang2)}_${Math.max(gang1, gang2)}`
    
    if (!this.conflictCache.has(conflictKey)) {
      const warfare1 = WarfareState.get(gang1)
      const warfare2 = WarfareState.get(gang2)
      
      warfare1.activeConflicts |= (1 << territoryId)
      warfare2.activeConflicts |= (1 << territoryId)
      
      this.conflictCache.set(conflictKey, {
        territory: territoryId,
        startTime: this.world.time,
        lastUpdate: this.world.time
      })
    }
  }

  private resolveConflicts() {
    for (const [key, conflict] of this.conflictCache) {
      if (this.world.time - conflict.lastUpdate > 100) {
        const [gang1, gang2] = key.split('_').map(Number)
        
        // Calculate war strength
        const strength1 = this.calculateWarStrength(gang1)
        const strength2 = this.calculateWarStrength(gang2)
        
        // Resolve conflict
        if (Math.abs(strength1 - strength2) > this.MIN_STRENGTH) {
          this.resolveTerritorialDispute(
            gang1, 
            gang2, 
            conflict.territory,
            strength1 > strength2 ? gang1 : gang2
          )
          this.conflictCache.delete(key)
        } else {
          // Stalemate - update casualties
          this.handleStalemate(gang1, gang2, conflict)
          conflict.lastUpdate = this.world.time
        }
      }
    }
  }

  private calculateWarStrength(gangster) {
    const warfare = WarfareState.get(gangster)
    const territory = TerritoryControl.get(gangster)
    
    // Base strength
    let strength = warfare.warStrength
    
    // Add ally strength
    let allyCount = 0
    let allyMask = warfare.allies
    while (allyMask) {
      if (allyMask & 1) {
        strength += this.getAllyContribution(gangster, allyCount)
      }
      allyMask >>= 1
      allyCount++
    }
    
    // Factor in territory control
    const controlBonus = territory.stability.reduce((sum, s) => sum + s, 0) / 16
    strength *= (1 + controlBonus)
    
    // Reputation modifier
    strength *= (1 + warfare.reputation * 0.2)
    
    return strength
  }

  private resolveTerrritorialDispute(gang1, gang2, territoryId, winner) {
    const territory1 = TerritoryControl.get(gang1)
    const territory2 = TerritoryControl.get(gang2)
    const warfare1 = WarfareState.get(gang1)
    const warfare2 = WarfareState.get(gang2)
    
    // Transfer territory control
    if (winner === gang1) {
      territory2.territories &= ~(1 << territoryId)
      territory1.territories |= (1 << territoryId)
      warfare1.victories++
      warfare2.casualties++
    } else {
      territory1.territories &= ~(1 << territoryId)
      territory2.territories |= (1 << territoryId)
      warfare2.victories++
      warfare1.casualties++
    }
    
    // Update reputation
    this.updateWarReputation(gang1, warfare1, winner === gang1)
    this.updateWarReputation(gang2, warfare2, winner === gang2)
    
    // Clear conflict flags
    warfare1.activeConflicts &= ~(1 << territoryId)
    warfare2.activeConflicts &= ~(1 << territoryId)
  }

  private updateWarReputation(gangster, warfare, victory) {
    if (victory) {
      warfare.reputation = Math.min(
        1, 
        warfare.reputation + 0.1
      )
    } else {
      warfare.reputation *= 0.8
    }
  }

  private maintainControl(gangster, territory, warfare) {
    // Check each controlled territory
    let controlMask = territory.territories
    let index = 0
    
    while (controlMask) {
      if (controlMask & 1) {
        // Calculate control stability
        const stability = this.calculateStability(
          gangster, 
          index, 
          territory, 
          warfare
        )
        
        // Update protection needs
        if (stability < 0.5) {
          this.reinforceTerritory(gangster, index, territory)
        }
        
        // Check for internal threats
        if (stability < 0.3) {
          this.handleInternalThreats(gangster, index, territory)
        }
      }
      controlMask >>= 1
      index++
    }
  }

  private calculateStability(gangster, territoryId, territory, warfare) {
    // Base stability from protection level
    let stability = territory.protection[territoryId] / 255
    
    // Reduce stability if at war
    if (warfare.activeConflicts & (1 << territoryId)) {
      stability *= 0.7
    }
    
    // Factor in enforcer presence
    const enforcerCount = this.countEnforcersInTerritory(
      territory.enforcers, 
      territoryId
    )
    stability += enforcerCount * 0.1
    
    // Consider nearby allied territories
    const alliedSupport = this.calculateAlliedSupport(
      territory.territories, 
      territoryId
    )
    stability += alliedSupport * 0.2
    
    return Math.min(1, stability)
  }
}

export { TerritoryControl, WarfareState, TerritorySystem }
