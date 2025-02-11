import { defineComponent, defineQuery, Types } from 'bitecs'

// Simplified emotional component - no fancy stuff, just what we need
const EmotionalCore = defineComponent({
  // Basic emotional state (-1 to 1)
  mood: Types.f32,
  energy: Types.f32,
  
  // What actually matters - how it affects behavior
  socialDrive: Types.f32,    // Tendency to seek/avoid others
  focusState: Types.f32,     // Ability to concentrate on tasks
  
  // Quick access to recent interactions (just 8 slots, keep it simple)
  recentInteractions: [Types.ui32, 8],
  interactionResults: [Types.i8, 8],  // -1 bad, 0 neutral, 1 good
  nextSlot: Types.ui8
})

// Behavior manifestations - what the emotion actually DOES
const BehaviorState = defineComponent({
  currentTask: Types.ui8,      // What they're doing right now
  taskProgress: Types.f32,     // How it's going (0-1)
  interruptible: Types.ui8,    // Can this be interrupted?
  failureCount: Types.ui8,     // Track recent failures
  successCount: Types.ui8      // Track recent successes
})

class EmotionalBehaviorSystem {
  constructor(world) {
    this.world = world
    this.entities = defineQuery([EmotionalCore, BehaviorState])
  }

  update() {
    const entities = this.entities(this.world)
    
    // One pass, multiple updates - efficiency!
    for (const entity of entities) {
      const emotion = EmotionalCore.get(entity)
      const behavior = BehaviorState.get(entity)
      
      // Update emotional state based on recent wins/failures
      this.updateMoodFromResults(emotion, behavior)
      
      // Pick something to do based on current state
      if (behavior.interruptible) {
        this.chooseBehavior(entity, emotion, behavior)
      }
      
      // Actually do the thing
      this.executeBehavior(entity, emotion, behavior)
    }
  }

  private updateMoodFromResults(emotion, behavior) {
    // More successes = better mood (with diminishing returns)
    const successImpact = Math.min(behavior.successCount * 0.1, 0.5)
    const failureImpact = Math.min(behavior.failureCount * 0.15, 0.7)
    
    // Update mood - failures hit harder than successes
    emotion.mood = Math.max(-1, Math.min(1, 
      emotion.mood + successImpact - failureImpact
    ))
    
    // Energy follows a natural cycle plus task impacts
    emotion.energy = Math.sin(this.world.time * 0.001) * 0.3 + 
                    Math.max(-1, Math.min(1, emotion.energy - 
                    (behavior.taskProgress * 0.1)))
  }

  private chooseBehavior(entity, emotion, behavior) {
    // Simple but effective behavior selection
    if (emotion.energy < -0.5) {
      // Too tired - rest
      behavior.currentTask = 1
      behavior.interruptible = 0
      return
    }
    
    if (emotion.mood < -0.3 && emotion.socialDrive > 0) {
      // Feeling bad - seek social interaction if that's their thing
      behavior.currentTask = 2
      behavior.interruptible = 1
      return
    }
    
    if (emotion.focusState > 0.5 && emotion.energy > 0) {
      // Good focus, decent energy - do something productive
      behavior.currentTask = 3
      behavior.interruptible = 1
      return
    }
    
    // Default - explore or wander
    behavior.currentTask = 0
    behavior.interruptible = 1
  }

  private executeBehavior(entity, emotion, behavior) {
    switch (behavior.currentTask) {
      case 0: // Explore
        this.doExploration(entity, emotion, behavior)
        break
      case 1: // Rest
        this.doRest(entity, emotion, behavior)
        break
      case 2: // Social
        this.doSocialInteraction(entity, emotion, behavior)
        break
      case 3: // Productive
        this.doProductiveTask(entity, emotion, behavior)
        break
    }
  }

  private doExploration(entity, emotion, behavior) {
    // Simple exploration behavior
    behavior.taskProgress += 0.1
    
    if (behavior.taskProgress >= 1) {
      // Finished exploring this area
      behavior.taskProgress = 0
      behavior.interruptible = 1
      
      // Maybe found something interesting?
      if (Math.random() > 0.7) {
        behavior.successCount++
        emotion.focusState += 0.1
      }
    }
  }

  private doRest(entity, emotion, behavior) {
    // Rest and recover
    behavior.taskProgress += 0.15
    emotion.energy += 0.05
    
    if (behavior.taskProgress >= 1 || emotion.energy >= 0.8) {
      // Well rested
      behavior.taskProgress = 0
      behavior.interruptible = 1
      behavior.successCount++
    }
  }

  private doSocialInteraction(entity, emotion, behavior) {
    // Find nearby entities
    const nearby = this.findNearbyEntities(entity)
    
    if (nearby.length > 0) {
      // Actually interact - success chance based on mood alignment
      const other = nearby[0]
      const otherEmotion = EmotionalCore.get(other)
      
      const moodDiff = Math.abs(emotion.mood - otherEmotion.mood)
      const success = Math.random() > moodDiff
      
      if (success) {
        behavior.successCount++
        emotion.mood += 0.1
        otherEmotion.mood += 0.1
      } else {
        behavior.failureCount++
        emotion.mood -= 0.15
      }
      
      // Record interaction result
      this.recordInteraction(emotion, other, success ? 1 : -1)
    }
    
    behavior.interruptible = 1
  }

  private doProductiveTask(entity, emotion, behavior) {
    // Progress on task based on focus and energy
    const progress = 0.1 * (emotion.focusState + 0.5) * 
                    (emotion.energy + 0.5)
    
    behavior.taskProgress += progress
    
    if (behavior.taskProgress >= 1) {
      // Task complete!
      behavior.taskProgress = 0
      behavior.successCount++
      emotion.focusState += 0.1
    }
  }

  private findNearbyEntities(entity) {
    // Simple distance check for now
    return this.entities(this.world).filter(other => 
      other !== entity && 
      this.getDistance(entity, other) < 10
    )
  }

  private recordInteraction(emotion, other, result) {
    const slot = emotion.nextSlot
    emotion.recentInteractions[slot] = other
    emotion.interactionResults[slot] = result
    emotion.nextSlot = (slot + 1) % 8
  }

  private getDistance(entity1, entity2) {
    // Get positions from world state
    const pos1 = this.world.getPosition(entity1)
    const pos2 = this.world.getPosition(entity2)
    
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2)
    )
  }
}

export { EmotionalCore, BehaviorState, EmotionalBehaviorSystem }
