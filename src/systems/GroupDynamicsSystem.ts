import { defineComponent, defineQuery, Types } from 'bitecs'

// Power dynamics component
const PowerDynamics = defineComponent({
  influence: Types.f32,       // Personal power within group
  loyalty: Types.f32,        // Loyalty to current group
  ambition: Types.f32,       // Tendency to seek leadership
  allies: [Types.ui32, 4],   // Strong personal connections
  rivals: [Types.ui32, 4],   // Personal adversaries
  favors: [Types.i8, 8],     // Owed favors (positive) or debts (negative)
  lastBetrayal: Types.ui32,  // Time since last betrayal
  leadershipScore: Types.f32 // Leadership capability score
})

// Alliance system for tracking group relationships
const AllianceState = defineComponent({
  allies: [Types.ui32, 4],    // Allied group IDs
  enemies: [Types.ui32, 4],   // Enemy group IDs
  trades: [Types.ui32, 4],    // Groups we trade with
  tensions: [Types.f32, 8],   // Growing conflicts with other groups
  dominance: Types.f32,       // Overall group power score
  stability: Types.f32        // Internal cohesion score
})

class PowerSystem {
  constructor(world) {
    this.world = world
    this.agents = defineQuery([PowerDynamics, GroupDynamics, ResourceState])
    this.alliances = new Map() // Group ID -> AllianceState
  }

  update() {
    const agents = this.agents(this.world)
    
    // Update group power dynamics
    this.updateGroupPower(agents)
    
    // Handle individual agent decisions
    for (const agent of agents) {
      const power = PowerDynamics.get(agent)
      const group = GroupDynamics.get(agent)
      const resources = ResourceState.get(agent)
      
      // Update personal influence
      this.updateInfluence(agent, power, group, resources)
      
      // Handle leadership challenges
      if (this.shouldChallenge(power, group)) {
        this.handleLeadershipChallenge(agent, power, group)
      }
      
      // Consider betrayal or alliance
      if (this.shouldReconsiderLoyalty(power, group, resources)) {
        this.handleLoyaltyDecision(agent, power, group, resources)
      }
    }
    
    // Resolve group conflicts and alliances
    this.resolveGroupDynamics()
  }

  private updateInfluence(agent, power, group, resources) {
    // Influence grows with successful resource gathering
    const resourceSuccess = resources.resources.reduce((sum, r) => sum + r, 0)
    power.influence += resourceSuccess * 0.1
    
    // Influence decays over time if not maintained
    power.influence *= 0.95
    
    // Leadership success increases influence
    if (group.role === 1 && group.actionSuccess) {
      power.influence += 0.2
    }
    
    // Cap influence at reasonable levels
    power.influence = Math.min(power.influence, 10)
  }

  private shouldChallenge(power, group) {
    return power.ambition > 0.7 && 
           power.influence > power.leadershipScore * 1.5 &&
           group.role !== 1 && // Not already leader
           power.lastBetrayal > 1000 // Cooldown on dramatic actions
  }

  private handleLeadershipChallenge(agent, power, group) {
    const currentLeader = this.findGroupLeader(group.groupId)
    if (!currentLeader) return
    
    const leaderPower = PowerDynamics.get(currentLeader)
    const support = this.calculateSupport(agent, currentLeader)
    
    if (support > 0.6 && power.influence > leaderPower.influence) {
      // Successful challenge
      this.transferLeadership(agent, currentLeader, group.groupId)
      power.lastBetrayal = 0 // Reset betrayal timer
    } else {
      // Failed challenge
      power.influence *= 0.5 // Major influence loss
      power.loyalty *= 0.7   // Loyalty questioned
      this.handleFailedChallenge(agent, currentLeader)
    }
  }

  private calculateSupport(challenger, leader) {
    const groupMembers = this.getGroupMembers(GroupDynamics.get(challenger).groupId)
    let support = 0
    
    for (const member of groupMembers) {
      if (member === challenger || member === leader) continue
      
      const memberPower = PowerDynamics.get(member)
      const memberGroup = GroupDynamics.get(member)
      
      // Factors affecting support
      const loyaltyFactor = memberPower.loyalty
      const influenceDiff = PowerDynamics.get(challenger).influence - 
                           PowerDynamics.get(leader).influence
      const personalTies = this.hasAllianceTie(member, challenger) ? 0.2 : 0
      const rivalryPenalty = this.hasRivalry(member, challenger) ? -0.3 : 0
      
      support += (influenceDiff * 0.3 + personalTies + rivalryPenalty) * 
                (1 - loyaltyFactor)
    }
    
    return support / (groupMembers.length - 2) // Normalize to 0-1
  }

  private handleLoyaltyDecision(agent, power, group, resources) {
    const currentGroupScore = this.evaluateGroupValue(agent, group)
    const alternatives = this.findAlternativeGroups(agent)
    
    for (const altGroup of alternatives) {
      const altScore = this.evaluateGroupValue(agent, altGroup)
      
      if (altScore > currentGroupScore * 1.5) {
        // Much better alternative found
        if (this.shouldBetray(power, group, resources)) {
          this.executeBetrayal(agent, altGroup)
          break
        }
      } else if (altScore > currentGroupScore * 1.2) {
        // Moderately better - consider alliance
        this.proposePact(agent, group, altGroup)
      }
    }
  }

  private shouldBetray(power, group, resources) {
    return power.loyalty < 0.3 && 
           resources.food < 0.2 && // Desperate times
           power.lastBetrayal > 2000 && // Significant cooldown
           Math.random() < 0.3 // Element of randomness
  }

  private executeBetrayal(agent, newGroup) {
    const power = PowerDynamics.get(agent)
    const oldGroup = GroupDynamics.get(agent)
    
    // Take some resources with you
    const resources = ResourceState.get(agent)
    const stolenAmount = Math.min(0.5, resources.resources.reduce((sum, r) => sum + r, 0))
    
    // Transfer to new group
    this.transferAgent(agent, oldGroup.groupId, newGroup.groupId)
    
    // Update relationships
    power.lastBetrayal = 0
    power.loyalty = 0.1
    power.influence *= 0.3 // Major influence drop in new group
    
    // Add old group to rivals
    this.addRival(agent, oldGroup.groupId)
  }

  private proposePact(agent, currentGroup, targetGroup) {
    const alliance = this.alliances.get(currentGroup.groupId)
    if (!alliance) return
    
    const tension = alliance.tensions[targetGroup.groupId] || 0
    if (tension < 0.3) { // Low tension makes alliance possible
      const success = Math.random() < 0.4 // 40% base chance
      if (success) {
        this.formAlliance(currentGroup.groupId, targetGroup.groupId)
      }
    }
  }

  private resolveGroupDynamics() {
    for (const [groupId, alliance] of this.alliances) {
      // Update tensions
      for (let i = 0; i < alliance.tensions.length; i++) {
        if (alliance.tensions[i] > 0) {
          // Tension naturally decays unless reinforced
          alliance.tensions[i] *= 0.95
        }
      }
      
      // Check alliance stability
      this.updateAllianceStability(groupId, alliance)
      
      // Handle group mergers or splits
      if (alliance.stability < 0.2) {
        this.handleGroupCollapse(groupId)
      }
    }
  }

  private updateAllianceStability(groupId, alliance) {
    const members = this.getGroupMembers(groupId)
    
    // Calculate internal cohesion
    let cohesion = 0
    for (const member of members) {
      const power = PowerDynamics.get(member)
      cohesion += power.loyalty
    }
    
    alliance.stability = (cohesion / members.length) * 
                        (1 - this.calculateInternalConflict(members))
  }
}

export { PowerDynamics, AllianceState, PowerSystem }
