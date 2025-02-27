export interface ProcessingError {
  stage: string;
  message: string;
  timestamp: Date;
}

export interface ProcessingErrorParams {
  stage: string;
  message: string;
  timestamp: Date;
}

export class ProcessingError extends Error {
  stage: string;
  timestamp: Date;

  constructor(params: ProcessingErrorParams) {
    super(params.message);
    this.stage = params.stage;
    this.timestamp = params.timestamp;
    this.name = 'ProcessingError';
  }
} 