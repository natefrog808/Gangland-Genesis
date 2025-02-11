import { World } from 'bitecs'
import { EmotionalBehaviorSystem } from './systems/EmotionalSystem'
import { EconomicPowerSystem } from './systems/EconomicSystem'
import { TerritorySystem } from './systems/TerritorySystem'
import { CrimeSystem } from './systems/CrimeSystem'

export class ArgosAdvanced {
  private world: any
  private emotionalSystem: EmotionalBehaviorSystem
  private economicSystem: EconomicPowerSystem
  private territorySystem: TerritorySystem
  private crimeSystem: CrimeSystem

  constructor() {
    this.world = World()
    this.emotionalSystem = new EmotionalBehaviorSystem(this.world)
    this.economicSystem = new EconomicPowerSystem(this.world)
    this.territorySystem = new TerritorySystem(this.world)
    this.crimeSystem = new CrimeSystem(this.world)
  }

  update() {
    this.emotionalSystem.update()
    this.economicSystem.update()
    this.territorySystem.update()
    this.crimeSystem.update()
    this.world.tick()
  }
}

export * from './components/EmotionalCore'
export * from './components/EconomicState'
export * from './components/TerritoryControl'
export * from './components/UndergroundEconomy'
export * from './components/CriminalOperations'
