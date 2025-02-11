import { defineComponent, defineQuery, Types } from 'bitecs'

// Efficient conspiracy tracking using bit flags
const ConspiracyState = defineComponent({
  membershipFlags: Types.ui32,    // Bitfield for conspiracy membership
  rank: [Types.ui8, 4],          // Rank in each conspiracy (0 = not member)
  knownMembers: Types.ui32,      // Bitfield of known fellow conspirators
  secretGoals: [Types.ui8, 4],   // Hidden objectives
  publicGoals: [Types.ui8, 4],   // Cover objectives
  trustNetwork: Types.ui32       // Bitfield of trusted agents
})

// Power structure component
const PowerStructure = defineComponent({
  leaderPosition: Types.ui8,      // Position in hierarchy
  succession: [Types.ui32, 4],    // Potential successors
  supporters: Types.ui32,         // Bitfield of loyal supporters
  rivals: Types.ui32,            // Bitfield of known rivals
  powerBase: Types.f32,          // Current power level
  stabilityFactor: Types.f32     // How secure the position is
})

class ConspiracySystem {
  private readonly MAX_CONSPIRACIES = 32  // Fits in a ui32 bitfield
  private readonly STABILITY_THRESHOLD = 0.3
  
  constructor(world) {
    this.world = world
    this.agents = defineQuery([ConspiracyState, PowerStructure])
    this.conspiracyCache = new Map() // Cache conspiracy calculations
  }

  update() {
    const agents = this.agents(this.world)
    
    // Clear old cache entries
    this.pruneCache()
    
    // Update power structures first
    this.updatePowerStructures(agents)
    
    // Handle any power vacuums
    const vacuums = this.detectPowerVacuums(agents)
    if (vacuums.length > 0) {
      this.handlePowerVacuums(vacuums, agents)
    }
    
    // Then update individual agents
    for (const agent of agents) {
      const conspiracy = ConspiracyState.get(agent)
      const power = PowerStructure.get(agent)
      
      // Quick stability check using bitwise ops
      if (this.needsStabilityCheck(conspiracy, power)) {
        this.assessStability(agent, conspiracy, power)
      }
      
      // Handle conspiracy interactions
      this.updateConspiracyStatus(agent, conspiracy, power)
    }
  }

  private needsStabilityCheck(conspiracy, power) {
    // Use bit operations for quick checks
    return (conspiracy.membershipFlags & power.supporters) !== power.supporters ||
           power.stabilityFactor < this.STABILITY_THRESHOLD
  }

  private updatePowerStructures(agents) {
    // Group updates by hierarchy level for efficiency
    const hierarchyLevels = new Map()
    
    for (const agent of agents) {
      const power = PowerStructure.get(agent)
      const level = power.leaderPosition
      
      if (!hierarchyLevels.has(level)) {
        hierarchyLevels.set(level, [])
      }
      hierarchyLevels.get(level).push(agent)
    }
    
    // Update from top down
    for (const level of [...hierarchyLevels.keys()].sort((a, b) => b - a)) {
      this.updateHierarchyLevel(hierarchyLevels.get(level))
    }
  }

  private updateHierarchyLevel(levelAgents) {
    // Calculate power dynamics for this level
    const powerShifts = new Map()
    
    for (const agent of levelAgents) {
      const power = PowerStructure.get(agent)
      const baseChange = this.calculatePowerShift(agent, power)
      powerShifts.set(agent, baseChange)
    }
    
    // Apply changes atomically
    for (const [agent, shift] of powerShifts) {
      PowerStructure.get(agent).powerBase += shift
    }
  }

  private detectPowerVacuums(agents) {
    const vacuums = []
    
    for (const agent of agents) {
      const power = PowerStructure.get(agent)
      
      if (power.leaderPosition > 0 && power.stabilityFactor < 0.2) {
        // Potential vacuum forming
        vacuums.push({
          position: power.leaderPosition,
          agent,
          severity: 1 - power.stabilityFactor
        })
      }
    }
    
    return vacuums
  }

  private handlePowerVacuums(vacuums, agents) {
    // Sort by severity and position
    vacuums.sort((a, b) => 
      b.severity - a.severity || b.position - a.position
    )
    
    for (const vacuum of vacuums) {
      const successors = this.findViableSuccessors(vacuum, agents)
      
      if (successors.length > 0) {
        // Trigger succession crisis
        this.initiateSuccessionCrisis(vacuum, successors)
      } else {
        // No clear successor - power collapse
        this.handlePowerCollapse(vacuum, agents)
      }
    }
  }

  private findViableSuccessors(vacuum, agents) {
    const power = PowerStructure.get(vacuum.agent)
    const candidates = []
    
    // Check designated successors first
    for (const successor of power.succession) {
      if (successor === 0) continue
      
      const successorPower = PowerStructure.get(successor)
      if (this.isViableSuccessor(successor, successorPower, vacuum)) {
        candidates.push({
          agent: successor,
          power: successorPower,
          support: this.calculateSupport(successor, agents)
        })
      }
    }
    
    // Then check other potential claimants
    for (const agent of agents) {
      if (power.succession.includes(agent)) continue
      
      const agentPower = PowerStructure.get(agent)
      if (this.isViableClaimant(agent, agentPower, vacuum)) {
        candidates.push({
          agent,
          power: agentPower,
          support: this.calculateSupport(agent, agents)
        })
      }
    }
    
    return candidates.sort((a, b) => b.support - a.support)
  }

  private initiateSuccessionCrisis(vacuum, successors) {
    // Create opposing factions
    const factions = this.divideSupporters(vacuum, successors)
    
    // Set up power struggle
    for (const faction of factions) {
      const conspiracy = ConspiracyState.get(faction.leader)
      
      // Create new conspiracy for this faction
      const conspiracyBit = this.allocateConspiracyBit()
      conspiracy.membershipFlags |= (1 << conspiracyBit)
      
      // Set up goals
      conspiracy.secretGoals[0] = this.GOALS.SEIZE_POWER
      conspiracy.publicGoals[0] = this.GOALS.RESTORE_STABILITY
      
      // Mark supporters
      for (const supporter of faction.supporters) {
        ConspiracyState.get(supporter).membershipFlags |= (1 << conspiracyBit)
      }
    }
  }

  private handlePowerCollapse(vacuum, agents) {
    const affected = this.findAffectedAgents(vacuum, agents)
    
    // Trigger cascade of power shifts
    for (const agent of affected) {
      const power = PowerStructure.get(agent)
      const conspiracy = ConspiracyState.get(agent)
      
      // Reduce all power positions
      power.leaderPosition = Math.max(0, power.leaderPosition - 1)
      power.stabilityFactor *= 0.5
      
      // Force conspiracy realignments
      this.forceConspiracyRealignment(agent, conspiracy, power)
    }
  }

  private updateConspiracyStatus(agent, conspiracy, power) {
    // Use cached calculations where possible
    const cacheKey = `${agent}_${conspiracy.membershipFlags}`
    
    if (this.conspiracyCache.has(cacheKey)) {
      const cached = this.conspiracyCache.get(cacheKey)
      if (cached.timestamp > this.world.time - 100) {
        return cached.status
      }
    }
    
    // Calculate new status
    const status = this.calculateConspiracyStatus(agent, conspiracy, power)
    
    // Cache result
    this.conspiracyCache.set(cacheKey, {
      status,
      timestamp: this.world.time
    })
    
    return status
  }
}

export { ConspiracyState, PowerStructure, ConspiracySystem }
