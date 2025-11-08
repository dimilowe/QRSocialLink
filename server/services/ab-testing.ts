import type { Destination } from "@shared/schema";

export interface ABStrategy {
  selectDestination(destinations: Destination[]): Destination;
}

export class WeightedRandomStrategy implements ABStrategy {
  selectDestination(destinations: Destination[]): Destination {
    if (destinations.length === 0) {
      throw new Error("No destinations available");
    }
    
    if (destinations.length === 1) {
      return destinations[0];
    }

    const totalWeight = destinations.reduce((sum, d) => sum + d.weight, 0);
    let random = Math.random() * totalWeight;

    for (const destination of destinations) {
      random -= destination.weight;
      if (random <= 0) {
        return destination;
      }
    }

    return destinations[destinations.length - 1];
  }
}

export class EpsilonGreedyStrategy implements ABStrategy {
  private epsilon: number;

  constructor(epsilon: number = 0.1) {
    this.epsilon = epsilon;
  }

  selectDestination(destinations: Destination[]): Destination {
    if (destinations.length === 0) {
      throw new Error("No destinations available");
    }
    
    if (destinations.length === 1) {
      return destinations[0];
    }

    if (Math.random() < this.epsilon) {
      const randomIndex = Math.floor(Math.random() * destinations.length);
      return destinations[randomIndex];
    }

    let bestDestination = destinations[0];
    let bestRate = this.getConversionRate(bestDestination);

    for (const destination of destinations.slice(1)) {
      const rate = this.getConversionRate(destination);
      if (rate > bestRate) {
        bestRate = rate;
        bestDestination = destination;
      }
    }

    return bestDestination;
  }

  private getConversionRate(destination: Destination): number {
    if (destination.impressions === 0) {
      return 0;
    }
    return destination.conversions / destination.impressions;
  }
}

export function createABStrategy(strategyType: string): ABStrategy {
  switch (strategyType) {
    case "weighted":
      return new WeightedRandomStrategy();
    case "epsilon-greedy":
      return new EpsilonGreedyStrategy();
    default:
      return new EpsilonGreedyStrategy();
  }
}
