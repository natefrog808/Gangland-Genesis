import { defineComponent, defineQuery, Types } from 'bitecs'

// Track hidden loyalties and faction dynamics
const FactionDynamics = defineComponent({
  declaredFaction: Types.ui32,    // Public allegiance
  trueFaction: Types.ui32,        // Secret allegiance
  factionStanding: [Types.f32, 8],// Standing with each faction
  infiltrationLevel: Types.f32,   // How deep we've infiltrated
  coverIdentity: Types.ui8,       // Type of cover story
  discoveryRisk: Types.f32,       // Risk of being exposed
  reportedIntel: [Types.ui8, 16], // Intel fed to each side
  disinformation: [Types.ui8, 8]  // False intel spread
})

// Faction-level schemes and goals
const FactionSchemes = defineComponent({
  primaryGoal: Types.ui8,         // Main objective
  subGoals: [Types.ui8, 4],       // Supporting objectives
  targetFaction: Types.ui32,      // Who we're moving against
  assets: [Types.ui32, 8],        // Agents and resources committed
  timeframe: Types.ui32,          // When scheme should execute
  contingencies: [Types.ui8, 4],  // Backup plans
  progress: Types.f32            // Progress toward goal
})

class FactionSystem {
  constructor(world) {
    this.world = world
    this.agents = defineQuery([FactionDynamics, PowerDynamics, ManipulationState])
    this.factions = new Map() // FactionId -> FactionSchemes
  }

  update() {
    // Handle faction-level updates
    this.updateFactionSchemes()
    
    // Then process individual agents
    const agents = this.agents(this.world)
    for (const agent of agents) {
      const faction = FactionDynamics.get(agent)
      const power = PowerDynamics.get(agent)
      const manip = ManipulationState.get(agent)
      
      // Update cover identities
      this.maintainCover(agent, faction, power)
      
      // Handle intel and disinformation
      this.manageIntelFlow(agent, faction, manip)
      
      // Check for potential exposure
      if (this.checkExposureRisk(agent, faction)) {
        this.handleExposure(agent, faction, power)
      }
      
      // Consider shifting loyalties
      this.evaluateLoyalties(agent, faction, power)
    }
  }

  private updateFactionSchemes() {
    for (const [factionId, schemes] of this.factions) {
      // Update scheme progress
      this.advanceSchemes(factionId, schemes)
      
      // Check for completed or failed schemes
      this.evaluateSchemeOutcomes(factionId, schemes)
      
      // Generate new schemes if needed
      if (this.needsNewSchemes(factionId)) {
        this.generateNewSchemes(factionId)
      }
    }
  }

  private maintainCover(agent, faction, power) {
    // Increase discovery risk based on activities
    faction.discoveryRisk += power.influence * 0.01
    
    // Risk increases more if we're very active
    if (power.lastBetrayal < 100) {
      faction.discoveryRisk += 0.1
    }
    
    // Periodically try to strengthen cover
    if (Math.random() < 0.1) {
      this.reinforceCover(agent, faction)
    }
  }

  private reinforceCover(agent, faction) {
    switch (faction.coverIdentity) {
      case 0: // Loyal member
        // Act extra loyal to throw off suspicion
        this.performLoyalActs(agent)
        faction.discoveryRisk *= 0.9
        break
      case 1: // Neutral party
        // Maintain careful balance of non-commitment
        this.maintainNeutrality(agent)
        faction.discoveryRisk *= 0.95
        break
      case 2: // Rival sympathizer
        // Openly criticize while secretly helping
        this.playBothSides(agent)
        faction.discoveryRisk *= 0.85
        break
    }
  }

  private manageIntelFlow(agent, faction, manip) {
    // Gather real intel
    const trueIntel = this.gatherIntel(agent, faction.trueFaction)
    
    // Decide what to report vs keep hidden
    const reported = this.filterIntel(trueIntel, faction)
    
    // Generate false intel if needed
    const disinfo = this.generateDisinformation(agent, faction)
    
    // Feed intel to appropriate factions
    this.distributeIntel(agent, reported, disinfo)
  }

  private filterIntel(intel, faction) {
    // More valuable intel increases discovery risk
    const intelValue = this.assessIntelValue(intel)
    faction.discoveryRisk += intelValue * 0.05
    
    // Filter based on current goals and risks
    return intel.filter(item => {
      const exposeRisk = this.calculateExposureRisk(item)
      return exposeRisk < faction.discoveryRisk * 2
    })
  }

  private generateDisinformation(agent, faction) {
    // Create misleading intel based on knowledge
    const disinfo = []
    const knowledge = this.getAgentKnowledge(agent)
    
    // More complex disinfo = higher risk
    const complexity = Math.min(3, Math.floor(knowledge.length / 2))
    for (let i = 0; i < complexity; i++) {
      const false_intel = this.fabricateIntel(knowledge[i])
      disinfo.push(false_intel)
      faction.discoveryRisk += 0.05
    }
    
    return disinfo
  }

  private checkExposureRisk(agent, faction) {
    // Base risk from activities
    let risk = faction.discoveryRisk
    
    // Adjust for agent's influence and reputation
    const power = PowerDynamics.get(agent)
    const manip = ManipulationState.get(agent)
    
    risk += power.influence * 0.1
    risk += manip.suspicion * 0.2
    
    // Check for specific risk factors
    if (this.hasConflictingIntel(agent)) risk += 0.3
    if (this.hasWitnesses(agent)) risk += 0.2
    if (this.hasInconsistentBehavior(agent)) risk += 0.15
    
    return Math.random() < risk
  }

  private handleExposure(agent, faction, power) {
    // Exposure severity depends on infiltration level
    const severity = faction.infiltrationLevel * 
                    (1 + power.influence)
    
    // Damage to both factions
    this.damageFactionStanding(agent, faction.declaredFaction, severity)
    this.damageFactionStanding(agent, faction.trueFaction, severity * 0.5)
    
    // Personal consequences
    power.influence *= 0.3
    ManipulationState.get(agent).reputation *= 0.2
    
    // Possible chain reaction
    this.triggerExposureFallout(agent, severity)
  }

  private evaluateLoyalties(agent, faction, power) {
    // Check if current alignment is still optimal
    const currentValue = this.evaluateFactionValue(faction.trueFaction)
    const alternatives = this.findViableFactions(agent)
    
    for (const alt of alternatives) {
      const altValue = this.evaluateFactionValue(alt)
      if (altValue > currentValue * 1.5) {
        // Much better option found - consider switching
        if (this.shouldSwitchLoyalty(agent, faction, power)) {
          this.switchFaction(agent, alt)
          break
        }
      }
    }
  }

  private shouldSwitchLoyalty(agent, faction, power) {
    // Consider multiple factors
    const currentStanding = faction.factionStanding[faction.trueFaction]
    const exposureRisk = faction.discoveryRisk
    const powerBase = power.influence
    
    // Higher threshold for well-established agents
    const threshold = 0.3 + (powerBase * 0.2) + 
                     (currentStanding * 0.3)
    
    // More likely to switch if at risk
    if (exposureRisk > 0.7) threshold *= 0.7
    
    return Math.random() > threshold
  }

  private switchFaction(agent, newFaction) {
    const faction = FactionDynamics.get(agent)
    const oldFaction = faction.trueFaction
    
    // Transfer loyalty
    faction.trueFaction = newFaction
    faction.infiltrationLevel = 0.1
    faction.discoveryRisk = 0.1
    
    // Clear old intel
    faction.reportedIntel.fill(0)
    faction.disinformation.fill(0)
    
    // Potentially expose some secrets about old faction
    this.leakOldFactionSecrets(agent, oldFaction, newFaction)
  }
}

export { FactionDynamics, FactionSchemes, FactionSystem }
