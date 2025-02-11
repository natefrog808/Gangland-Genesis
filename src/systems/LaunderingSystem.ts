import { defineComponent, defineQuery, Types } from 'bitecs'

// Money laundering network
const LaunderingNetwork = defineComponent({
  shellCompanies: Types.ui32,     // Bitfield of front companies
  cleanMoney: Types.ui32,         // Legitimate-looking funds
  dirtyMoney: Types.ui32,         // Funds needing laundering
  launderCapacity: [Types.ui16, 8], // How much each front can process
  auditRisk: Types.f32,          // Risk of investigation
  methodMask: Types.ui8          // Which methods are currently safe
})

// Corruption and protection
const CorruptionNetwork = defineComponent({
  payroll: Types.ui32,           // Bitfield of corrupted officials
  protection: [Types.ui8, 8],    // Level of protection in each domain
  leverage: Types.ui32,          // Blackmail material on officials
  payments: [Types.ui16, 8],     // Regular payment amounts
  reliability: [Types.f32, 8],   // How reliable each corrupt contact is
  exposure: Types.f32           // Risk of network exposure
})

class CrimeSystem {
  private readonly AUDIT_THRESHOLD = 0.7
  private readonly MAX_SHELLS = 32
  
  constructor(world) {
    this.world = world
    this.criminals = defineQuery([
      LaunderingNetwork, 
      CorruptionNetwork,
      UndergroundEconomy
    ])
    // Track laundering routes for efficient updates
    this.launderingRoutes = new Map()
    // Cache for protection calculations
    this.protectionCache = new Map()
  }

  update() {
    const criminals = this.criminals(this.world)
    
    // Update laundering operations
    this.updateLaundering(criminals)
    
    // Handle protection payments and corruption
    this.updateCorruption(criminals)
    
    // Process individual criminal operations
    for (const criminal of criminals) {
      const laundering = LaunderingNetwork.get(criminal)
      const corruption = CorruptionNetwork.get(criminal)
      const underground = UndergroundEconomy.get(criminal)
      
      // Move dirty money through network
      if (laundering.dirtyMoney > 0) {
        this.processLaundering(criminal, laundering, corruption)
      }
      
      // Maintain corruption network
      this.maintainProtection(criminal, corruption, underground)
      
      // Check for investigations
      if (this.needsInvestigationResponse(laundering, corruption)) {
        this.handleInvestigation(criminal, laundering, corruption)
      }
    }
  }

  private updateLaundering(criminals) {
    // Group by shell company clusters for efficient processing
    const shellClusters = new Map()
    
    for (const criminal of criminals) {
      const laundering = LaunderingNetwork.get(criminal)
      const shellPattern = laundering.shellCompanies.toString(2)
      
      if (!shellClusters.has(shellPattern)) {
        shellClusters.set(shellPattern, [])
      }
      shellClusters.get(shellPattern).push(criminal)
    }
    
    // Process each cluster
    for (const [pattern, cluster] of shellClusters) {
      this.processShellCluster(cluster, pattern)
    }
  }

  private processShellCluster(cluster, pattern) {
    // Calculate total laundering activity
    let totalActivity = 0
    const companies = new Set()
    
    for (const criminal of cluster) {
      const laundering = LaunderingNetwork.get(criminal)
      totalActivity += laundering.dirtyMoney
      
      // Track which shell companies are being used
      for (let i = 0; i < this.MAX_SHELLS; i++) {
        if (laundering.shellCompanies & (1 << i)) {
          companies.add(i)
        }
      }
    }
    
    // Adjust risk based on activity concentration
    const riskFactor = totalActivity / companies.size
    
    // Update each criminal's audit risk
    for (const criminal of cluster) {
      const laundering = LaunderingNetwork.get(criminal)
      laundering.auditRisk += riskFactor * 0.01
    }
  }

  private processLaundering(criminal, laundering, corruption) {
    // Calculate safe laundering amount
    const safeAmount = this.calculateSafeLaundering(laundering, corruption)
    
    if (safeAmount > 0) {
      // Try different methods based on amount
      const methods = this.selectLaunderingMethods(safeAmount, laundering)
      
      for (const method of methods) {
        const amount = Math.min(
          safeAmount, 
          laundering.launderCapacity[method]
        )
        
        if (this.executeLaundering(criminal, amount, method)) {
          laundering.dirtyMoney -= amount
          laundering.cleanMoney += amount * 0.9 // 10% laundering fee
        }
      }
    }
  }

  private calculateSafeLaundering(laundering, corruption) {
    // Consider audit risk
    const riskFactor = 1 - laundering.auditRisk
    
    // Factor in protection
    let protectionBonus = 0
    for (const protection of corruption.protection) {
      protectionBonus += protection * 0.1
    }
    
    // Calculate base safe amount
    let safeAmount = laundering.dirtyMoney * riskFactor * (1 + protectionBonus)
    
    // Limit by available methods
    const methodCapacity = this.calculateMethodCapacity(laundering)
    
    return Math.min(safeAmount, methodCapacity)
  }

  private selectLaunderingMethods(amount, laundering) {
    const methods = []
    let remaining = amount
    
    // Check each method bit in the mask
    for (let i = 0; i < 8; i++) {
      if (laundering.methodMask & (1 << i)) {
        const capacity = laundering.launderCapacity[i]
        if (capacity > 0) {
          methods.push(i)
          remaining -= capacity
          if (remaining <= 0) break
        }
      }
    }
    
    return methods
  }

  private maintainProtection(criminal, corruption, underground) {
    // Handle regular payments
    for (let i = 0; i < corruption.payments.length; i++) {
      if (corruption.payments[i] > 0) {
        if (this.makeProtectionPayment(criminal, i, corruption)) {
          // Update protection level
          corruption.protection[i] = 
            Math.min(255, corruption.protection[i] + 1)
        } else {
          // Failed payment - protection decreases
          corruption.protection[i] = 
            Math.max(0, corruption.protection[i] - 2)
        }
      }
    }
    
    // Check reliability
    this.updateReliability(corruption)
    
    // Consider new protection opportunities
    if (this.needsMoreProtection(corruption, underground)) {
      this.seekNewProtection(criminal, corruption)
    }
  }

  private handleInvestigation(criminal, laundering, corruption) {
    // Calculate total protection
    const totalProtection = corruption.protection.reduce((a, b) => a + b, 0)
    
    // Try to deflect investigation
    if (totalProtection > 100) {
      // Strong protection - might deflect
      if (Math.random() < totalProtection / 255) {
        laundering.auditRisk *= 0.5
        return
      }
    }
    
    // Investigation succeeds - burn compromised assets
    this.burnCompromisedAssets(criminal, laundering, corruption)
  }

  private burnCompromisedAssets(criminal, laundering, corruption) {
    // Identify most exposed shells
    const compromised = this.findCompromisedShells(laundering)
    
    // Remove compromised shells
    laundering.shellCompanies &= ~compromised
    
    // Reduce capacity of remaining shells
    for (let i = 0; i < laundering.launderCapacity.length; i++) {
      laundering.launderCapacity[i] *= 0.5
    }
    
    // Mark some methods as unsafe
    laundering.methodMask &= 0xF0 // Clear lower methods
    
    // Identify and remove unreliable protection
    this.removeCompromisedProtection(corruption)
  }

  private removeCompromisedProtection(corruption) {
    for (let i = 0; i < corruption.reliability.length; i++) {
      if (corruption.reliability[i] < 0.3) {
        // Remove protection
        corruption.protection[i] = 0
        corruption.payments[i] = 0
        corruption.payroll &= ~(1 << i)
      }
    }
  }
}

export { LaunderingNetwork, CorruptionNetwork, CrimeSystem }
