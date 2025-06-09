import * as tf from '@tensorflow/tfjs-node';
import { Strategy } from '../shared/types/strategy';

export class MLStrategyOptimizer {
  private model: tf.LayersModel;
  private mcpClient: any;
  
  constructor(mcpClient: any) {
    this.mcpClient = mcpClient;
  }
  
  async initialize() {
    // Load or create model
    try {
      this.model = await tf.loadLayersModel('file://./models/strategy-optimizer/model.json');
    } catch (error) {
      // Create new model if not exists
      this.model = this.createModel();
    }
  }
  
  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [50], // Features: market indicators, strategy params, etc.
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 4, // Outputs: expected return, sharpe, max_dd, win_rate
          activation: 'linear'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    return model;
  }
  
  async optimizeStrategy(strategy: Strategy, marketConditions: any): Promise<any> {
    // Prepare features
    const features = await this.prepareFeatures(strategy, marketConditions);
    
    // Get current performance prediction
    const currentPrediction = await this.predict(features);
    
    // Optimize parameters using gradient-based search
    const optimizedParams = await this.optimizeParameters(
      strategy.parameters,
      features,
      currentPrediction
    );
    
    // Validate optimization
    const optimizedFeatures = await this.prepareFeatures(
      { ...strategy, parameters: optimizedParams },
      marketConditions
    );
    const optimizedPrediction = await this.predict(optimizedFeatures);
    
    return {
      original_params: strategy.parameters,
      optimized_params: optimizedParams,
      expected_improvement: {
        return: optimizedPrediction.return - currentPrediction.return,
        sharpe: optimizedPrediction.sharpe - currentPrediction.sharpe,
        max_drawdown: currentPrediction.max_drawdown - optimizedPrediction.max_drawdown,
        win_rate: optimizedPrediction.win_rate - currentPrediction.win_rate
      },
      confidence: this.calculateConfidence(optimizedPrediction)
    };
  }
  
  async trainOnHistoricalData(trainingData: any[]) {
    // Prepare training dataset
    const dataset = await this.prepareTrainingData(trainingData);
    
    // Split into features and labels
    const features = dataset.map(d => d.features);
    const labels = dataset.map(d => d.labels);
    
    // Convert to tensors
    const xTrain = tf.tensor2d(features);
    const yTrain = tf.tensor2d(labels);
    
    // Train model
    await this.model.fit(xTrain, yTrain, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs!.loss}`);
        }
      }
    });
    
    // Save model
    await this.model.save('file://./models/strategy-optimizer');
    
    // Cleanup tensors
    xTrain.dispose();
    yTrain.dispose();
  }
  
  private async prepareFeatures(strategy: Strategy, marketConditions: any): Promise<number[]> {
    const features: number[] = [];
    
    // Strategy parameters
    features.push(
      strategy.parameters.entry_conditions.length,
      strategy.parameters.exit_conditions.length,
      strategy.parameters.stop_loss || 0,
      strategy.parameters.take_profit || 0,
      strategy.parameters.max_positions || 1
    );
    
    // Market conditions
    features.push(
      marketConditions.volatility || 0,
      marketConditions.trend_strength || 0,
      marketConditions.correlation_index || 0,
      marketConditions.volume_ratio || 1,
      marketConditions.sentiment_score || 0
    );
    
    // Technical indicators
    const indicators = marketConditions.indicators || {};
    features.push(
      indicators.rsi || 50,
      indicators.macd || 0,
      indicators.bollinger_position || 0.5,
      indicators.atr || 0,
      indicators.adx || 0
    );
    
    // Pad to expected input size
    while (features.length < 50) {
      features.push(0);
    }
    
    return features.slice(0, 50);
  }
  
  private async predict(features: number[]): Promise<any> {
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const values = await prediction.array() as number[][];
    
    input.dispose();
    prediction.dispose();
    
    return {
      return: values[0][0],
      sharpe: values[0][1],
      max_drawdown: values[0][2],
      win_rate: values[0][3]
    };
  }
  
  private async optimizeParameters(
    currentParams: any,
    features: number[],
    currentPrediction: any
  ): Promise<any> {
    // Simplified optimization - in production use proper optimization algorithms
    const optimized = { ...currentParams };
    
    // Try different parameter variations
    const variations = [
      { stop_loss: currentParams.stop_loss * 0.9 },
      { stop_loss: currentParams.stop_loss * 1.1 },
      { take_profit: currentParams.take_profit * 0.9 },
      { take_profit: currentParams.take_profit * 1.1 }
    ];
    
    let bestParams = currentParams;
    let bestScore = this.calculateScore(currentPrediction);
    
    for (const variation of variations) {
      const testParams = { ...currentParams, ...variation };
      const testFeatures = features.slice(); // Clone features
      // Update features based on variation
      
      const prediction = await this.predict(testFeatures);
      const score = this.calculateScore(prediction);
      
      if (score > bestScore) {
        bestScore = score;
        bestParams = testParams;
      }
    }
    
    return bestParams;
  }
  
  private calculateScore(prediction: any): number {
    // Weighted score based on multiple objectives
    return (
      prediction.return * 0.3 +
      prediction.sharpe * 0.3 +
      (1 - prediction.max_drawdown) * 0.2 +
      prediction.win_rate * 0.2
    );
  }
  
  private calculateConfidence(prediction: any): number {
    // Simplified confidence calculation
    const scores = [
      prediction.return,
      prediction.sharpe,
      1 - prediction.max_drawdown,
      prediction.win_rate
    ];
    
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    
    // Lower variance = higher confidence
    return Math.max(0, 1 - Math.sqrt(variance));
  }
  
  private async prepareTrainingData(historicalData: any[]): Promise<any[]> {
    const dataset: any[] = [];
    
    for (const record of historicalData) {
      const features = await this.prepareFeatures(
        record.strategy,
        record.market_conditions
      );
      
      const labels = [
        record.actual_return,
        record.actual_sharpe,
        record.actual_max_drawdown,
        record.actual_win_rate
      ];
      
      dataset.push({ features, labels });
    }
    
    return dataset;
  }
}

// Anomaly detection for market conditions
export class MarketAnomalyDetector {
  private autoencoder: tf.LayersModel;
  private threshold: number = 0.05;
  
  constructor() {
    this.autoencoder = this.createAutoencoder();
  }
  
  private createAutoencoder(): tf.LayersModel {
    // Encoder
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [30], // Market features
          units: 20,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 10,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 5, // Latent space
          activation: 'relu'
        })
      ]
    });
    
    // Decoder
    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [5],
          units: 10,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 20,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 30,
          activation: 'sigmoid'
        })
      ]
    });
    
    // Combined model
    const input = tf.input({ shape: [30] });
    const encoded = encoder.apply(input) as tf.SymbolicTensor;
    const decoded = decoder.apply(encoded) as tf.SymbolicTensor;
    
    const autoencoder = tf.model({ inputs: input, outputs: decoded });
    
    autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    return autoencoder;
  }
  
  async detectAnomalies(marketData: any): Promise<any> {
    const features = this.extractMarketFeatures(marketData);
    const input = tf.tensor2d([features]);
    
    // Get reconstruction
    const reconstruction = this.autoencoder.predict(input) as tf.Tensor;
    const reconstructionArray = await reconstruction.array() as number[][];
    
    // Calculate reconstruction error
    const error = this.calculateReconstructionError(features, reconstructionArray[0]);
    
    // Cleanup
    input.dispose();
    reconstruction.dispose();
    
    const isAnomaly = error > this.threshold;
    
    return {
      is_anomaly: isAnomaly,
      anomaly_score: error,
      anomaly_features: this.identifyAnomalousFeatures(features, reconstructionArray[0]),
      confidence: this.calculateAnomalyConfidence(error)
    };
  }
  
  private extractMarketFeatures(marketData: any): number[] {
    const features: number[] = [];
    
    // Price features
    features.push(
      marketData.price_change_1h || 0,
      marketData.price_change_24h || 0,
      marketData.price_change_7d || 0
    );
    
    // Volume features
    features.push(
      marketData.volume_ratio_1h || 1,
      marketData.volume_ratio_24h || 1,
      marketData.volume_change || 0
    );
    
    // Volatility features
    features.push(
      marketData.volatility_1h || 0,
      marketData.volatility_24h || 0,
      marketData.volatility_7d || 0
    );
    
    // Market structure
    features.push(
      marketData.spread || 0,
      marketData.order_book_imbalance || 0,
      marketData.trade_count_ratio || 1
    );
    
    // Normalize and pad
    const normalized = this.normalizeFeatures(features);
    while (normalized.length < 30) {
      normalized.push(0);
    }
    
    return normalized.slice(0, 30);
  }
  
  private normalizeFeatures(features: number[]): number[] {
    // Simple min-max normalization
    return features.map(f => Math.max(0, Math.min(1, (f + 100) / 200)));
  }
  
  private calculateReconstructionError(original: number[], reconstructed: number[]): number {
    let error = 0;
    for (let i = 0; i < original.length; i++) {
      error += Math.pow(original[i] - reconstructed[i], 2);
    }
    return Math.sqrt(error / original.length);
  }
  
  private identifyAnomalousFeatures(original: number[], reconstructed: number[]): string[] {
    const anomalous: string[] = [];
    const featureNames = [
      'price_change_1h', 'price_change_24h', 'price_change_7d',
      'volume_ratio_1h', 'volume_ratio_24h', 'volume_change',
      'volatility_1h', 'volatility_24h', 'volatility_7d',
      'spread', 'order_book_imbalance', 'trade_count_ratio'
    ];
    
    for (let i = 0; i < Math.min(original.length, featureNames.length); i++) {
      const diff = Math.abs(original[i] - reconstructed[i]);
      if (diff > 0.1) { // 10% difference
        anomalous.push(featureNames[i]);
      }
    }
    
    return anomalous;
  }
  
  private calculateAnomalyConfidence(error: number): number {
    // Sigmoid function for confidence
    return 1 / (1 + Math.exp(-10 * (error - this.threshold)));
  }
}
