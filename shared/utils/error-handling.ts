export class FieldElevateError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly retryable: boolean;
  public readonly context?: any;
  
  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    retryable: boolean = false,
    context?: any
  ) {
    super(message);
    this.name = 'FieldElevateError';
    this.code = code;
    this.severity = severity;
    this.retryable = retryable;
    this.context = context;
  }
}

export class RetryableError extends FieldElevateError {
  public readonly maxRetries: number;
  public readonly retryDelay: number;
  
  constructor(
    message: string,
    code: string,
    maxRetries: number = 3,
    retryDelay: number = 1000,
    context?: any
  ) {
    super(message, code, 'medium', true, context);
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }
}

export class ValidationError extends FieldElevateError {
  public readonly validationErrors: any[];
  
  constructor(message: string, validationErrors: any[], context?: any) {
    super(message, 'VALIDATION_ERROR', 'low', false, context);
    this.validationErrors = validationErrors;
  }
}

export class ExecutionError extends FieldElevateError {
  public readonly failedOperation: string;
  
  constructor(
    message: string,
    failedOperation: string,
    severity: 'medium' | 'high' | 'critical' = 'high',
    context?: any
  ) {
    super(message, 'EXECUTION_ERROR', severity, false, context);
    this.failedOperation = failedOperation;
  }
}

export class RiskLimitError extends FieldElevateError {
  public readonly limitType: string;
  public readonly currentValue: number;
  public readonly limit: number;
  
  constructor(
    message: string,
    limitType: string,
    currentValue: number,
    limit: number,
    context?: any
  ) {
    super(message, 'RISK_LIMIT_EXCEEDED', 'critical', false, context);
    this.limitType = limitType;
    this.currentValue = currentValue;
    this.limit = limit;
  }
}

export interface ErrorHandler {
  handle(error: Error): Promise<void>;
  canHandle(error: Error): boolean;
}

export class GlobalErrorHandler {
  private handlers: ErrorHandler[] = [];
  private mcpClient: any;
  
  constructor(mcpClient: any) {
    this.mcpClient = mcpClient;
    this.registerDefaultHandlers();
  }
  
  registerHandler(handler: ErrorHandler) {
    this.handlers.push(handler);
  }
  
  async handle(error: Error, context?: any) {
    // Log error
    await this.logError(error, context);
    
    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(error));
    
    if (handler) {
      await handler.handle(error);
    } else {
      // Default handling
      await this.defaultHandle(error);
    }
    
    // Notify if critical
    if (error instanceof FieldElevateError && error.severity === 'critical') {
      await this.notifyCriticalError(error);
    }
  }
  
  private registerDefaultHandlers() {
    // Retry handler
    this.registerHandler({
      canHandle: (error) => error instanceof RetryableError,
      handle: async (error: RetryableError) => {
        let attempts = 0;
        while (attempts < error.maxRetries) {
          try {
            await new Promise(resolve => setTimeout(resolve, error.retryDelay));
            // Retry logic would go here
            return;
          } catch (retryError) {
            attempts++;
          }
        }
        throw new Error(`Failed after ${attempts} retries: ${error.message}`);
      }
    });
    
    // Risk limit handler
    this.registerHandler({
      canHandle: (error) => error instanceof RiskLimitError,
      handle: async (error: RiskLimitError) => {
        // Stop trading
        await this.mcpClient.callApp('trade-runner', 'emergency_stop', {
          reason: `Risk limit exceeded: ${error.limitType}`
        });
        
        // Create alert
        await this.mcpClient.callApp('ops-console', 'create_alert', {
          severity: 'critical',
          title: 'Risk Limit Exceeded',
          message: error.message,
          data: {
            limit_type: error.limitType,
            current_value: error.currentValue,
            limit: error.limit
          }
        });
      }
    });
    
    // Validation error handler
    this.registerHandler({
      canHandle: (error) => error instanceof ValidationError,
      handle: async (error: ValidationError) => {
        // Log validation errors
        console.error('Validation errors:', error.validationErrors);
        
        // Send to monitoring
        await this.mcpClient.streamData('validation:failed', {
          errors: error.validationErrors,
          context: error.context,
          timestamp: new Date()
        });
      }
    });
  }
  
  private async logError(error: Error, context?: any) {
    const errorLog: any = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context,
      timestamp: new Date()
    };
    
    if (error instanceof FieldElevateError) {
      errorLog['code'] = error.code;
      errorLog['severity'] = error.severity;
      errorLog['retryable'] = error.retryable;
    }
    
    await this.mcpClient.streamData('error:logged', errorLog);
  }
  
  private async defaultHandle(error: Error) {
    console.error('Unhandled error:', error);
    
    // Create alert for operations team
    await this.mcpClient.callApp('ops-console', 'create_alert', {
      severity: 'high',
      title: 'Unhandled Error',
      message: error.message,
      stack: error.stack
    });
  }
  
  private async notifyCriticalError(error: FieldElevateError) {
    await this.mcpClient.callApp('ops-console', 'send_notification', {
      type: 'critical_error',
      recipients: ['oncall@fieldelevate.com'],
      subject: `Critical Error: ${error.code}`,
      message: error.message,
      require_acknowledgment: true
    });
  }
}

// Retry utility
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        if (onRetry) {
          onRetry(attempt + 1, error as Error);
        }
        
        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

// Circuit breaker
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
      
    } catch (error) {
      this.failures++;
      this.lastFailureTime = new Date();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
  
  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
  }
}
