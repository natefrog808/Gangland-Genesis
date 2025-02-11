import { defineComponent, defineQuery, Types } from 'bitecs'

// Revenge and manipulation tracking
const RevengePlans = defineComponent({
  target: Types.ui32,           // Who wronged us
  severity: Types.f32,          // How bad was the betrayal (0-1)
  plotTime: Types.ui32,         // How long we've been planning
  allies: [Types.ui32, 4],      // Fellow revenge-seekers
  method: Types.ui8,            // Type of revenge planned
  readiness: Types.f32,         // How prepared we are (0-1)
  backupPlans: [Types.ui8, 2],  // Alternative revenge methods
  exposureRisk: Types.f32       // Chance of being caught
})

// Manipulation and influence tracking
const ManipulationState = defineComponent({
  puppets: [Types.ui32, 4],     // Agents under our influence
  secrets: [Types.ui8, 8],      // Dirt we have on others
  promises: [Types.i8, 8],      // Outstanding deals (positive=owed to us)
  network: [Types.ui32, 8],     // Our web of contacts
  reputation: Types.f32,        // How others view our reliability
  suspicion: Types.f32         // How much others distrust us
})

class SchemeSystem {
  constructor(world) {
    this.world = world
    this.schemers = defineQuery([RevengePlans, ManipulationState, PowerDynamics])
  }

  update() {
    const schemers = this.schemers(this.world)
    
    for (const schemer of schemers) {
      const revenge = RevengePlans.get(schemer)
      const manipulation = ManipulationState.get(schemer)
      const power = PowerDynamics.get(schemer)
      
      // Update ongoing schemes
      if (revenge.target) {
        this.advanceRevengePlot(schemer, revenge, manipulation)
      }
      
      // Look for new opportunities
      this.seekNewSchemes(schemer, revenge, manipulation, power)
      
      // Maintain manipulation network
      this.maintainNetwork(schemer, manipulation, power)
    }
    
    // Resolve any schemes ready for execution
    this.resolveSchemes()
  }

  private advanceRevengePlot(schemer, revenge, manipulation) {
    // Progress revenge plot based on preparation and resources
    revenge.plotTime++
    
    // More time = better prepared, but diminishing returns
    revenge.readiness = Math.min(1, revenge.plotTime * 0.001)
    
    // Gather allies if needed
    if (revenge.allies.filter(a => a !== 0).length < 2) {
      this.recruitRevengeAllies(schemer, revenge, manipulation)
    }
    
    // Check if we're ready to strike
    if (this.isRevengeReady(revenge)) {
      this.executeRevenge(schemer, revenge, manipulation)
    }
  }

  private recruitRevengeAllies(schemer, revenge, manipulation) {
    const potentialAllies = this.findPotentialAllies(schemer, revenge.target)
    
    for (const ally of potentialAllies) {
      const allyPower = PowerDynamics.get(ally)
      const allyManip = ManipulationState.get(ally)
      
      // Check if we can manipulate them into helping
      if (this.canInfluence(manipulation, allyManip, allyPower)) {
        this.addRevengeAlly(revenge, ally)
        // Add a favor they owe us
        manipulation.promises[ally] = 1
        break
      }
    }
  }

  private canInfluence(ourManip, theirManip, theirPower) {
    // Can influence if:
    // 1. We have dirt on them (secrets)
    // 2. They owe us favors
    // 3. We have high reputation and they're ambitious
    return this.haveSecretOn(ourManip, theirManip) ||
           this.owesFavors(ourManip, theirManip) ||
           (ourManip.reputation > 0.7 && theirPower.ambition > 0.8)
  }

  private executeRevenge(schemer, revenge, manipulation) {
    const target = revenge.target
    const targetPower = PowerDynamics.get(target)
    const targetGroup = GroupDynamics.get(target)
    
    switch (revenge.method) {
      case 0: // Sabotage
        this.sabotageTarget(target, revenge.severity)
        break
      case 1: // Power grab
        this.usurpPosition(schemer, target, revenge.allies)
        break
      case 2: // Resource theft
        this.orchestrateTheft(schemer, target, revenge.allies)
        break
      case 3: // Reputation destruction
        this.destroyReputation(target, manipulation, revenge.severity)
        break
    }
    
    // Cleanup after revenge
    this.handleRevengeFallout(schemer, revenge, manipulation)
  }

  private sabotageTarget(target, severity) {
    const targetResources = ResourceState.get(target)
    const targetPower = PowerDynamics.get(target)
    
    // Damage their resources
    targetResources.resources = targetResources.resources.map(r => 
      Math.max(0, r - severity * 0.5)
    )
    
    // Hit their influence
    targetPower.influence *= (1 - severity * 0.3)
  }

  private usurpPosition(schemer, target, allies) {
    const targetGroup = GroupDynamics.get(target)
    const schemerPower = PowerDynamics.get(schemer)
    
    // Calculate coup success chance
    const support = this.calculateCoupSupport(schemer, target, allies)
    
    if (support > 0.7) {
      // Successful coup
      this.transferGroupControl(targetGroup.groupId, schemer)
      schemerPower.influence += targetPower.influence * 0.5
      targetPower.influence *= 0.2
    } else {
      // Failed coup - consequences
      this.handleFailedCoup(schemer, target, allies)
    }
  }

  private destroyReputation(target, manipulation, severity) {
    const targetManip = ManipulationState.get(target)
    const targetPower = PowerDynamics.get(target)
    
    // Reveal their secrets
    if (this.haveSecretOn(manipulation, targetManip)) {
      targetManip.reputation *= (1 - severity * 0.4)
      targetPower.influence *= (1 - severity * 0.3)
      
      // Their puppets might abandon them
      this.reevaluateLoyalties(target)
    }
  }

  private handleRevengeFallout(schemer, revenge, manipulation) {
    // Revenge increases suspicion
    manipulation.suspicion += revenge.severity * 0.2
    
    // Pay off allies
    for (const ally of revenge.allies) {
      if (ally !== 0) {
        manipulation.promises[ally] = -1 // Now we owe them
      }
    }
    
    // Reset revenge plan
    revenge.target = 0
    revenge.plotTime = 0
    revenge.readiness = 0
    revenge.allies.fill(0)
  }

  private maintainNetwork(schemer, manipulation, power) {
    // Decay suspicion over time
    manipulation.suspicion *= 0.95
    
    // Maintain or build new connections
    for (const contact of manipulation.network) {
      if (contact !== 0) {
        if (Math.random() < 0.1) {
          // Chance to gain a secret
          this.gatherIntel(schemer, contact, manipulation)
        }
      }
    }
    
    // Handle promises and favors
    this.managePromises(schemer, manipulation, power)
  }

  private gatherIntel(schemer, target, manipulation) {
    const targetState = this.getFullState(target)
    
    // Look for vulnerabilities
    const vulnerabilities = this.findVulnerabilities(targetState)
    if (vulnerabilities.length > 0) {
      // Store as a secret
      const secretIndex = manipulation.secrets.findIndex(s => s === 0)
      if (secretIndex !== -1) {
        manipulation.secrets[secretIndex] = vulnerabilities[0]
      }
    }
  }

  private managePromises(schemer, manipulation, power) {
    for (let i = 0; i < manipulation.promises.length; i++) {
      const promise = manipulation.promises[i]
      if (promise !== 0) {
        if (promise > 0) {
          // They owe us - collect or increase debt
          this.collectDebt(schemer, i, manipulation)
        } else {
          // We owe them - pay or suffer reputation hit
          this.payDebt(schemer, i, manipulation, power)
        }
      }
    }
  }
}

export { RevengePlans, ManipulationState, SchemeSystem }
