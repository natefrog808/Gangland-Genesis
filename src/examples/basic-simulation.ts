import { World } from 'bitecs'
import { 
  EmotionalCore, 
  PowerDynamics,
  TerritoryControl,
  UndergroundEconomy,
  ConspiracyState
} from '../components'

import {
  EmotionalBehaviorSystem,
  PowerSystem,
  TerritorySystem,
  UndergroundSystem,
  ConspiracySystem
} from '../systems'

class Simulation {
  private world
  private emotionalSystem
  private powerSystem
  private territorySystem
  private undergroundSystem
  private conspiracySystem
  
  constructor() {
    // Initialize world
    this.world = World()
    
    // Initialize systems
    this.emotionalSystem = new EmotionalBehaviorSystem(this.world)
    this.powerSystem = new PowerSystem(this.world)
    this.territorySystem = new TerritorySystem(this.world)
    this.undergroundSystem = new UndergroundSystem(this.world)
    this.conspiracySystem = new ConspiracySystem(this.world)
    
    // Create initial agents
    this.createInitialAgents(10) // Start with 10 agents
  }

  private createInitialAgents(count: number) {
    for (let i = 0; i < count; i++) {
      const agent = this.world.createEntity()
      
      // Add components to agent
      EmotionalCore.add(agent)
      PowerDynamics.add(agent)
      TerritoryControl.add(agent)
      UndergroundEconomy.add(agent)
      ConspiracyState.add(agent)
      
      // Initialize starting values
      const emotional = EmotionalCore.get(agent)
      emotional.mood = Math.random() * 2 - 1    // -1 to 1
      emotional.energy = Math.random()          // 0 to 1
      emotional.socialDrive = Math.random()
      
      const power = PowerDynamics.get(agent)
      power.influence = Math.random() * 0.3     // Start with low influence
      power.ambition = Math.random()
      
      // Add territory control
      const territory = TerritoryControl.get(agent)
      territory.territories = 1 << Math.floor(Math.random() * 16) // Random territory
    }
  }

  update() {
    // Update all systems
    this.emotionalSystem.update()
    this.powerSystem.update()
    this.territorySystem.update()
    this.undergroundSystem.update()
    this.conspiracySystem.update()
    
    // Advance world time
    this.world.tick()
  }

  // Debug helpers
  getAgentStatus(agentId: number) {
    const emotional = EmotionalCore.get(agentId)
    const power = PowerDynamics.get(agentId)
    const territory = TerritoryControl.get(agentId)
    
    return {
      emotional: {
        mood: emotional.mood,
        energy: emotional.energy,
        socialDrive: emotional.socialDrive
      },
      power: {
        influence: power.influence,
        ambition: power.ambition
      },
      territory: {
        controlled: territory.territories.toString(2)
      }
    }
  }

  visualizeWorld() {
    const agents = this.world.getEntities()
    console.log('\nWorld Status:')
    agents.forEach(agent => {
      console.log(`Agent ${agent}:`, this.getAgentStatus(agent))
    })
  }
}

// Run a test simulation
const sim = new Simulation()

// Run for 100 ticks
for (let i = 0; i < 100; i++) {
  sim.update()
  if (i % 10 === 0) { // Show status every 10 ticks
    sim.visualizeWorld()
  }
}
