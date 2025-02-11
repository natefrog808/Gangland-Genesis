import { defineComponent, defineQuery, Types } from 'bitecs'

// Hit operations tracking
const HitOperations = defineComponent({
  hitSquads: Types.ui16,         // Available hit teams
  targets: [Types.ui32, 8],      // Priority targets
  successRate: Types.f32,        // Hit success history
  heatLevel: Types.f32,          // Police attention
  methodMask: Types.ui8,         // Available hit methods
  cooldown: [Types.ui16, 8]      // Cooldown per territory
})

// Intelligence network
const IntelNetwork = defineComponent({
  informants: Types.ui32,        // Bitfield of active informants
  reliability: [Types.f32, 16],  // How reliable each informant is
  coverage: Types.ui32,          // What territories we have intel on
  intel: [Types.ui8, 32],        // Gathered intelligence
  compromised: Types.ui32,       // Known burned informants
  payroll: [Types.ui16, 16]      // Informant payment amounts
})

class HitSystem {
  private readonly MAX_HEAT = 0.8
  private readonly COOLDOWN_TIME = 1000
  
  constructor(world) {
    this.world = world
    this.operators = defineQuery([
      HitOperations, 
      IntelNetwork,
      WarfareState
    ])
    // Cache hit opportunities for performance
    this.hitOpportunities = new Map()
    // Track recent hits for pattern detection
    this.recentHits = new Array()
  }

  update() {
    const operators = this.operators(this.world)
    
    // Update intel networks first
    this.updateIntelNetworks(operators)
    
    // Then process hit operations
    for (const operator of operators) {
      const hits = HitOperations.get(operator)
      const intel = IntelNetwork.get(operator)
      const warfare = WarfareState.get(operator)
      
      // Process gathered intel
      this.processIntel(operator, intel)
      
      // Consider hit opportunities
      if (hits.hitSquads > 0 && hits.heatLevel < this.MAX_HEAT) {
        this.evaluateHitOpportunities(operator, hits, intel)
      }
      
      // Cool down heat level
      this.manageHeatLevel(operator, hits, warfare)
    }
    
    // Clean up old hit records
    this.cleanupHitRecords()
  }

  private updateIntelNetworks(operators) {
    for (const operator of operators) {
      const intel = IntelNetwork.get(operator)
      
      // Update each active informant
      let informantMask = intel.informants
      let index = 0
      
      while (informantMask) {
        if (informantMask & 1) {
          this.updateInformant(operator, index, intel)
        }
        informantMask >>= 1
        index++
      }
      
      // Check for compromised informants
      this.detectCompromisedInformants(operator, intel)
    }
  }

  private updateInformant(operator, informantId, intel) {
    // Check if informant is still reliable
    if (intel.reliability[informantId] < 0.2) {
      // Cut ties with unreliable informant
      intel.informants &= ~(1 << informantId)
      return
    }
    
    // Gather intel based on coverage
    const newIntel = this.gatherInformantIntel(
      operator, 
      informantId, 
      intel.coverage
    )
    
    // Store gathered intel
    for (let i = 0; i < newIntel.length; i++) {
      const slot = (informantId * 2 + i) % 32
      intel.intel[slot] = newIntel[i]
    }
    
    // Update reliability based on intel quality
    intel.reliability[informantId] *= 0.95 + 
      (this.verifyIntelQuality(newIntel) * 0.1)
  }

  private evaluateHitOpportunities(operator, hits, intel) {
    // Find high-value targets from intel
    const targets = this.identifyTargets(operator, intel)
    
    for (const target of targets) {
      const opportunity = this.assessHitOpportunity(
        operator, 
        target, 
        hits, 
        intel
      )
      
      if (opportunity.score > 0.7 && this.isTerritorySafe(target.territory)) {
        this.executeHit(operator, target, opportunity, hits)
      }
    }
  }

  private executeHit(operator, target, opportunity, hits) {
    // Select hit method based on circumstances
    const method = this.selectHitMethod(target, opportunity, hits.methodMask)
    
    // Calculate success chance
    const successChance = this.calculateHitSuccess(
      operator,
      target,
      method,
      opportunity
    )
    
    if (Math.random() < successChance) {
      this.successfulHit(operator, target, method)
    } else {
      this.failedHit(operator, target, method)
    }
    
    // Update hit squad availability
    hits.hitSquads--
    
    // Set cooldown for territory
    hits.cooldown[target.territory] = this.COOLDOWN_TIME
    
    // Record hit for pattern analysis
    this.recordHit(operator, target, method, successChance)
  }

  private successfulHit(operator, target, method) {
    const hits = HitOperations.get(operator)
    const warfare = WarfareState.get(target.gang)
    
    // Update success rate
    hits.successRate = hits.successRate * 0.9 + 0.1
    
    // Apply hit effects
    switch (method) {
      case 0: // Drive-by
        this.applyDriveByEffects(target)
        hits.heatLevel += 0.2
        break
      case 1: // Assassination
        this.applyAssassinationEffects(target)
        hits.heatLevel += 0.4
        break
      case 2: // Bombing
        this.applyBombingEffects(target)
        hits.heatLevel += 0.6
        break
    }
    
    // Update warfare state
    warfare.casualties++
    warfare.warStrength *= 0.9
  }

  private failedHit(operator, target, method) {
    const hits = HitOperations.get(operator)
    const warfare = WarfareState.get(target.gang)
    
    // Update success rate
    hits.successRate = hits.successRate * 0.9
    
    // Increase heat substantially on failure
    hits.heatLevel += 0.4
    
    // Target gets intelligence boost
    this.leakIntelToTarget(operator, target)
    
    // Update warfare state
    warfare.warStrength *= 1.1 // Failed hit makes them stronger
  }

  private manageHeatLevel(operator, hits, warfare) {
    // Natural heat decay
    hits.heatLevel *= 0.95
    
    // Reduce heat based on protection
    const protection = this.calculateProtection(operator)
    hits.heatLevel *= (1 - protection * 0.1)
    
    // Update cooldowns
    for (let i = 0; i < hits.cooldown.length; i++) {
      if (hits.cooldown[i] > 0) {
        hits.cooldown[i]--
      }
    }
  }

  private detectCompromisedInformants(operator, intel) {
    // Check each informant for suspicious patterns
    let informantMask = intel.informants
    let index = 0
    
    while (informantMask) {
      if (informantMask & 1) {
        if (this.isInformantCompromised(operator, index, intel)) {
          // Mark as compromised
          intel.compromised |= (1 << index)
          // Remove from active informants
          intel.informants &= ~(1 << index)
          // Zero out their intel
          intel.intel[index * 2] = 0
          intel.intel[index * 2 + 1] = 0
        }
      }
      informantMask >>= 1
      index++
    }
  }
}

export { HitOperations, IntelNetwork, HitSystem }
