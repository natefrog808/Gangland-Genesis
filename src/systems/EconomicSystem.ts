import { defineComponent, defineQuery, Types } from 'bitecs'

// Economic influence tracking
const EconomicState = defineComponent({
  resources: [Types.ui32, 8],     // Resource quantities in powers of 2
  control: Types.ui32,            // Bitfield of controlled resource nodes
  trade: [Types.ui16, 16],        // Recent trade partners and volumes
  debts: [Types.i16, 8],         // Outstanding debts (negative = owed to others)
  marketInfluence: Types.f32,     // Impact on resource prices
  blackmail: Types.ui32          // Economic leverage over others (bitfield)
})

// Emergency powers tracking
const EmergencyPowers = defineComponent({
  active: Types.ui8,              // Current emergency measures
  duration: Types.ui32,           // How long powers have been active
  justification: Types.ui8,       // Type of crisis used to justify
  opposition: Types.ui32,         // Bitfield of those resisting
  enforcers: Types.ui32,         // Bitfield of loyal enforcement agents
  severity: Types.f32            // How strict the measures are
})

class EconomicPowerSystem {
  constructor(world) {
    this.world = world
    this.powerHolders = defineQuery([
      EconomicState, 
      PowerStructure, 
      ConspiracyState
    ])
    // Performance optimization: pre-calculate power thresholds
    this.powerThresholds = new Float32Array(32)
    this.initPowerThresholds()
  }

  private initPowerThresholds() {
    for (let i = 0; i < 32; i++) {
      // Exponential scaling of power requirements
      this.powerThresholds[i] = Math.pow(1.5, i)
    }
  }

  update() {
    const holders = this.powerHolders(this.world)
    
    // Batch process economic updates
    this.batchUpdateEconomics(holders)
    
    // Check for economic crises
    const crises = this.detectEconomicCrises(holders)
    if (crises.length > 0) {
      this.handleEconomicCrises(crises, holders)
    }
    
    // Update emergency powers
    this.updateEmergencyMeasures(holders)
  }

  private batchUpdateEconomics(holders) {
    // Group holders by resource control for efficient updates
    const controlGroups = new Map()
    
    for (const holder of holders) {
      const economic = EconomicState.get(holder)
      const controlBits = economic.control.toString(2)
      
      controlGroups.set(controlBits, [
        ...(controlGroups.get(controlBits) || []),
        holder
      ])
    }
    
    // Update each control group in parallel
    for (const [controlBits, group] of controlGroups) {
      this.updateResourceControl(group, controlBits)
    }
  }

  private updateResourceControl(group, controlBits) {
    const resources = new Float32Array(8) // Resource totals
    
    // Calculate total resources first
    for (const holder of group) {
      const economic = EconomicState.get(holder)
      for (let i = 0; i < 8; i++) {
        resources[i] += economic.resources[i]
      }
    }
    
    // Then distribute influence based on control
    const influence = this.calculateControlInfluence(controlBits, resources)
    
    for (const holder of group) {
      const economic = EconomicState.get(holder)
      const power = PowerStructure.get(holder)
      
      // Update market influence
      economic.marketInfluence = influence * 
        (power.powerBase / this.powerThresholds[power.leaderPosition])
    }
  }

  private detectEconomicCrises(holders) {
    const crises = []
    const resourceState = new Float32Array(8)
    
    // First pass: gather total resource state
    for (const holder of holders) {
      const economic = EconomicState.get(holder)
      for (let i = 0; i < 8; i++) {
        resourceState[i] += economic.resources[i]
      }
    }
    
    // Second pass: detect imbalances and manipulation
    for (const holder of holders) {
      const economic = EconomicState.get(holder)
      const power = PowerStructure.get(holder)
      
      // Check for resource monopolies
      for (let i = 0; i < 8; i++) {
        if (economic.resources[i] > resourceState[i] * 0.4) {
          crises.push({
            type: 'monopoly',
            resource: i,
            holder,
            severity: economic.resources[i] / resourceState[i]
          })
        }
      }
      
      // Check for debt crises
      const totalDebt = economic.debts.reduce((sum, debt) => sum + debt, 0)
      if (totalDebt < -1000) {
        crises.push({
          type: 'debt',
          holder,
          severity: Math.abs(totalDebt) / 1000
        })
      }
      
      // Check for market manipulation
      if (economic.marketInfluence > 0.6) {
        crises.push({
          type: 'manipulation',
          holder,
          severity: economic.marketInfluence
        })
      }
    }
    
    return crises
  }

  private handleEconomicCrises(crises, holders) {
    // Sort crises by severity
    crises.sort((a, b) => b.severity - a.severity)
    
    for (const crisis of crises) {
      const emergency = EmergencyPowers.get(crisis.holder)
      const power = PowerStructure.get(crisis.holder)
      
      if (crisis.severity > 0.8 && !emergency.active) {
        // Severe crisis - might trigger emergency powers
        this.declareEmergencyPowers(crisis, emergency, power)
      } else if (emergency.active) {
        // Crisis during emergency - adjust measures
        this.adjustEmergencyMeasures(crisis, emergency, power)
      }
      
      // Apply economic penalties
      this.applyEconomicPenalties(crisis)
    }
  }

  private declareEmergencyPowers(crisis, emergency, power) {
    emergency.active = 1
    emergency.duration = 0
    emergency.justification = crisis.type
    emergency.severity = crisis.severity
    
    // Initial emergency measures
    switch (crisis.type) {
      case 'monopoly':
        this.implementAntiMonopolyMeasures(crisis)
        break
      case 'debt':
        this.implementDebtControls(crisis)
        break
      case 'manipulation':
        this.implementMarketControls(crisis)
        break
    }
  }

  private updateEmergencyMeasures(holders) {
    for (const holder of holders) {
      const emergency = EmergencyPowers.get(holder)
      if (!emergency.active) continue
      
      const power = PowerStructure.get(holder)
      const economic = EconomicState.get(holder)
      
      // Update duration
      emergency.duration++
      
      // Check if emergency powers should continue
      if (this.shouldMaintainEmergency(emergency, power, economic)) {
        this.updateEmergencyEnforcement(holder, emergency)
      } else {
        this.liftEmergencyPowers(holder, emergency, power)
      }
    }
  }

  private shouldMaintainEmergency(emergency, power, economic) {
    // Calculate opposition strength
    const oppositionPower = this.calculateOppositionPower(emergency.opposition)
    
    // Check if crisis is truly resolved
    const crisisResolved = this.isCrisisResolved(emergency, economic)
    
    // Calculate stability impact
    const stabilityImpact = emergency.duration * 0.01
    
    return !crisisResolved && 
           oppositionPower < power.powerBase * 1.2 &&
           power.stabilityFactor - stabilityImpact > 0.2
  }

  private updateEmergencyEnforcement(holder, emergency) {
    // Update enforcer loyalty
    const newEnforcers = emergency.enforcers
    
    for (let i = 0; i < 32; i++) {
      if (newEnforcers & (1 << i)) {
        // Check enforcer loyalty
        if (!this.isEnforcerLoyal(holder, i, emergency.duration)) {
          newEnforcers &= ~(1 << i) // Remove disloyal enforcer
        }
      }
    }
    
    emergency.enforcers = newEnforcers
    
    // Adjust severity based on enforcement capability
    const enforcerCount = this.countBits(newEnforcers)
    emergency.severity = Math.min(
      1, 
      emergency.severity * (enforcerCount / this.countBits(emergency.opposition))
    )
  }

  private liftEmergencyPowers(holder, emergency, power) {
    // Calculate stability impact
    const stabilityHit = emergency.duration * 0.005
    power.stabilityFactor = Math.max(0, power.stabilityFactor - stabilityHit)
    
    // Reset emergency state
    emergency.active = 0
    emergency.duration = 0
    emergency.severity = 0
    emergency.enforcers = 0
    
    // Trigger power structure updates
    this.handlePostEmergencyTransition(holder)
  }
}

export { EconomicState, EmergencyPowers, EconomicPowerSystem }
